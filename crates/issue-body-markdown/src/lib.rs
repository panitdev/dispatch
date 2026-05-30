use std::{error::Error, fmt};

use serde::{Deserialize, Serialize};
use serde_json::Value;

const MARKER_PREFIX: &str = "<!-- dispatch:heading=";
const MARKER_SUFFIX: &str = " -->";

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
pub struct IssueBodyBlock {
    pub id: String,
    pub kind: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(default)]
    pub content: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub metadata: Option<Value>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ImportError {
    MissingHeading { line: usize, kind: String },
    InvalidHeading { line: usize, kind: String },
}

impl fmt::Display for ImportError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ImportError::MissingHeading { line, kind } => {
                write!(
                    f,
                    "dispatch heading marker for `{kind}` at line {line} is missing a heading"
                )
            }
            ImportError::InvalidHeading { line, kind } => {
                write!(f, "dispatch heading marker for `{kind}` at line {line} is not followed by an ATX heading")
            }
        }
    }
}

impl Error for ImportError {}

pub fn to_markdown(blocks: &[IssueBodyBlock]) -> String {
    let mut markdown = String::new();

    for block in blocks {
        if block.kind != "markdown" {
            if !markdown.is_empty() && !markdown.ends_with('\n') {
                markdown.push('\n');
            }
            if !markdown.is_empty() && !markdown.ends_with("\n\n") {
                markdown.push('\n');
            }

            markdown.push_str(MARKER_PREFIX);
            markdown.push_str(&block.kind);
            markdown.push_str(MARKER_SUFFIX);
            markdown.push('\n');
            markdown.push_str("## ");
            markdown.push_str(block.title.as_deref().unwrap_or(&block.kind));
            markdown.push_str("\n\n");
        }

        if !block.content.is_empty() {
            markdown.push_str(&block.content);
            if !markdown.ends_with('\n') {
                markdown.push('\n');
            }
        }
    }

    markdown
}

pub fn from_markdown_with_ids<F>(
    markdown: &str,
    mut next_id: F,
) -> Result<Vec<IssueBodyBlock>, ImportError>
where
    F: FnMut() -> String,
{
    let lines: Vec<&str> = markdown.split_inclusive('\n').collect();
    let mut blocks = Vec::new();
    let mut current = PendingBlock::new_markdown();
    let mut in_fence: Option<char> = None;
    let mut index = 0;

    while index < lines.len() {
        let line = lines[index];
        let line_number = index + 1;

        if let Some(fence_char) = in_fence {
            current.content.push_str(line);
            if closes_fence(line, fence_char) {
                in_fence = None;
            }
            index += 1;
            continue;
        }

        if let Some(fence_char) = opens_fence(line) {
            in_fence = Some(fence_char);
            current.content.push_str(line);
            index += 1;
            continue;
        }

        if let Some(kind) = parse_marker(line) {
            let Some(heading_line) = lines.get(index + 1) else {
                return Err(ImportError::MissingHeading {
                    line: line_number,
                    kind,
                });
            };

            let Some(title) = parse_atx_heading(heading_line) else {
                return Err(ImportError::InvalidHeading {
                    line: line_number,
                    kind,
                });
            };

            flush_pending(&mut blocks, &mut current, &mut next_id);
            current = PendingBlock {
                kind,
                title: Some(title),
                content: String::new(),
            };
            index += 2;
            continue;
        }

        current.content.push_str(line);
        index += 1;
    }

    flush_pending(&mut blocks, &mut current, &mut next_id);
    Ok(blocks)
}

#[derive(Debug, Clone)]
struct PendingBlock {
    kind: String,
    title: Option<String>,
    content: String,
}

impl PendingBlock {
    fn new_markdown() -> Self {
        Self {
            kind: "markdown".to_owned(),
            title: None,
            content: String::new(),
        }
    }
}

fn flush_pending<F>(blocks: &mut Vec<IssueBodyBlock>, pending: &mut PendingBlock, next_id: &mut F)
where
    F: FnMut() -> String,
{
    let content = pending.content.trim_matches('\n').to_owned();
    if pending.kind == "markdown" && content.is_empty() {
        return;
    }

    blocks.push(IssueBodyBlock {
        id: next_id(),
        kind: pending.kind.clone(),
        title: pending.title.clone(),
        content,
        metadata: None,
    });

    *pending = PendingBlock::new_markdown();
}

fn parse_marker(line: &str) -> Option<String> {
    let trimmed = line.trim();
    let kind = trimmed
        .strip_prefix(MARKER_PREFIX)?
        .strip_suffix(MARKER_SUFFIX)?;

    if is_valid_kind(kind) {
        Some(kind.to_owned())
    } else {
        None
    }
}

fn is_valid_kind(kind: &str) -> bool {
    !kind.is_empty()
        && kind
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
}

fn parse_atx_heading(line: &str) -> Option<String> {
    let trimmed = line.trim_start();
    let hashes = trimmed.bytes().take_while(|b| *b == b'#').count();

    if hashes == 0 || hashes > 6 {
        return None;
    }

    let rest = &trimmed[hashes..];
    if !rest.starts_with(' ') && !rest.starts_with('\t') {
        return None;
    }

    let title = rest.trim();
    if title.is_empty() {
        return None;
    }

    Some(title.trim_end_matches('#').trim_end().to_owned())
}

fn opens_fence(line: &str) -> Option<char> {
    let trimmed = line.trim_start();
    if trimmed.starts_with("```") {
        Some('`')
    } else if trimmed.starts_with("~~~") {
        Some('~')
    } else {
        None
    }
}

fn closes_fence(line: &str, fence_char: char) -> bool {
    let trimmed = line.trim_start();
    match fence_char {
        '`' => trimmed.starts_with("```"),
        '~' => trimmed.starts_with("~~~"),
        _ => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn exports_section_marker_and_heading() {
        let markdown = to_markdown(&[IssueBodyBlock {
            id: "1".to_owned(),
            kind: "situation".to_owned(),
            title: Some("Situation".to_owned()),
            content: "The current state.".to_owned(),
            metadata: None,
        }]);

        assert_eq!(
            markdown,
            "<!-- dispatch:heading=situation -->\n## Situation\n\nThe current state.\n"
        );
    }

    #[test]
    fn imports_normal_headings_as_markdown() {
        let blocks = from_markdown_with_ids("# Heading\n\nBody\n", id_generator()).unwrap();

        assert_eq!(
            blocks,
            vec![IssueBodyBlock {
                id: "id-1".to_owned(),
                kind: "markdown".to_owned(),
                title: None,
                content: "# Heading\n\nBody".to_owned(),
                metadata: None,
            }]
        );
    }

    #[test]
    fn imports_preamble_as_markdown_block() {
        let markdown = "Intro\n\n<!-- dispatch:heading=situation -->\n## Situation\n\nState\n";
        let blocks = from_markdown_with_ids(markdown, id_generator()).unwrap();

        assert_eq!(blocks.len(), 2);
        assert_eq!(blocks[0].kind, "markdown");
        assert_eq!(blocks[0].content, "Intro");
        assert_eq!(blocks[1].kind, "situation");
        assert_eq!(blocks[1].title.as_deref(), Some("Situation"));
        assert_eq!(blocks[1].content, "State");
    }

    #[test]
    fn round_trips_multiple_sections() {
        let blocks = vec![
            IssueBodyBlock {
                id: "1".to_owned(),
                kind: "situation".to_owned(),
                title: Some("Situation".to_owned()),
                content: "- one\n- two".to_owned(),
                metadata: None,
            },
            IssueBodyBlock {
                id: "2".to_owned(),
                kind: "action".to_owned(),
                title: Some("Action".to_owned()),
                content: "Do it.".to_owned(),
                metadata: None,
            },
        ];

        let imported = from_markdown_with_ids(&to_markdown(&blocks), id_generator()).unwrap();

        assert_eq!(imported[0].kind, "situation");
        assert_eq!(imported[0].title.as_deref(), Some("Situation"));
        assert_eq!(imported[0].content, "- one\n- two");
        assert_eq!(imported[1].kind, "action");
        assert_eq!(imported[1].title.as_deref(), Some("Action"));
        assert_eq!(imported[1].content, "Do it.");
    }

    #[test]
    fn ignores_markers_inside_fenced_code() {
        let markdown = "```md\n<!-- dispatch:heading=situation -->\n## Situation\n```\n";
        let blocks = from_markdown_with_ids(markdown, id_generator()).unwrap();

        assert_eq!(blocks.len(), 1);
        assert_eq!(blocks[0].kind, "markdown");
        assert_eq!(
            blocks[0].content,
            "```md\n<!-- dispatch:heading=situation -->\n## Situation\n```"
        );
    }

    #[test]
    fn rejects_marker_without_heading() {
        let error = from_markdown_with_ids(
            "<!-- dispatch:heading=situation -->\nBody\n",
            id_generator(),
        )
        .unwrap_err();

        assert_eq!(
            error,
            ImportError::InvalidHeading {
                line: 1,
                kind: "situation".to_owned()
            }
        );
    }

    fn id_generator() -> impl FnMut() -> String {
        let mut id = 0;
        move || {
            id += 1;
            format!("id-{id}")
        }
    }
}
