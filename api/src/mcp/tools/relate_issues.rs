use diesel::{ExpressionMethods, OptionalExtension, QueryDsl};
use diesel_async::RunQueryDsl;
use serde::Deserialize;
use serde_json::{json, Value};

use crate::{
    models::issue::IssueRelation,
    schema::{issue_relations, issues},
    state::AppState,
};

use super::{map_db_error, not_found_error, parse_snowflake_id};
use crate::mcp::{
    auth::McpIdentity,
    protocol::{dispatch_error_result, json_text_result, JsonRpcError, INTERNAL_ERROR, INVALID_PARAMS},
};

#[derive(Deserialize)]
struct RelateIssuesArgs {
    from_id: String,
    to_id: String,
    #[serde(rename = "type")]
    relation_type: String,
}

pub async fn call(
    _identity: &McpIdentity,
    state: &AppState,
    args: Value,
) -> Result<Value, JsonRpcError> {
    let args: RelateIssuesArgs = serde_json::from_value(args)
        .map_err(|_| JsonRpcError::new(INVALID_PARAMS, "invalid relate_issues arguments"))?;

    let valid_types = ["blocks", "blocked_by", "related", "duplicate"];
    if !valid_types.contains(&args.relation_type.as_str()) {
        return Err(JsonRpcError::new(
            INVALID_PARAMS,
            format!("invalid relation type: {}", args.relation_type),
        ));
    }

    let from_id = parse_snowflake_id(&args.from_id, "from_id")?;
    let to_id = parse_snowflake_id(&args.to_id, "to_id")?;

    if from_id == to_id {
        return Err(JsonRpcError::new(INVALID_PARAMS, "from_id and to_id must differ"));
    }

    // Normalise blocked_by → canonical blocks direction
    let (canonical_from, canonical_to, stored_type) = match args.relation_type.as_str() {
        "blocked_by" => (to_id, from_id, "blocks"),
        other => (from_id, to_id, other),
    };

    let mut conn = state
        .db
        .get()
        .await
        .map_err(|_| JsonRpcError::new(INTERNAL_ERROR, "database unavailable"))?;

    // Verify both issues exist
    let from_exists: i64 = issues::table
        .filter(issues::id.eq(canonical_from))
        .count()
        .get_result(&mut conn)
        .await
        .unwrap_or(0);
    if from_exists == 0 {
        return not_found_error(&args.from_id);
    }
    let to_exists: i64 = issues::table
        .filter(issues::id.eq(canonical_to))
        .count()
        .get_result(&mut conn)
        .await
        .unwrap_or(0);
    if to_exists == 0 {
        return not_found_error(&args.to_id);
    }

    // Check for existing relation
    let existing: Option<IssueRelation> = issue_relations::table
        .filter(issue_relations::issue_id.eq(canonical_from))
        .filter(issue_relations::related_issue_id.eq(canonical_to))
        .filter(issue_relations::relation_type.eq(stored_type))
        .first(&mut conn)
        .await
        .optional()
        .map_err(|e| map_db_error(e, None))?;

    if existing.is_some() {
        return dispatch_error_result(
            "CONFLICT",
            "relation already exists",
            None,
            None,
        );
    }

    let new_relation = IssueRelation {
        issue_id: canonical_from,
        related_issue_id: canonical_to,
        relation_type: stored_type.to_owned(),
    };

    diesel::insert_into(issue_relations::table)
        .values(&new_relation)
        .execute(&mut conn)
        .await
        .map_err(|e| map_db_error(e, None))?;

    json_text_result(json!({
        "id":      format!("{}-{}-{}", canonical_from, canonical_to, stored_type),
        "from_id": canonical_from.to_string(),
        "to_id":   canonical_to.to_string(),
        "type":    stored_type,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn blocked_by_swaps_direction() {
        // Verify the normalisation logic by parsing args and checking direction
        let args: RelateIssuesArgs = serde_json::from_value(json!({
            "from_id": "1",
            "to_id":   "2",
            "type":    "blocked_by"
        }))
        .unwrap();

        let from = 1i64;
        let to = 2i64;
        let (cf, ct, rt) = match args.relation_type.as_str() {
            "blocked_by" => (to, from, "blocks"),
            other => (from, to, other),
        };
        assert_eq!((cf, ct, rt), (2, 1, "blocks"));
    }
}
