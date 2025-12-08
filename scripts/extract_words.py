#!/usr/bin/env python3

import sys
import re

COMMENT_RE = re.compile(r"/\*\*.*?\*/", re.DOTALL)
STACK_RE = re.compile(r"\([^)]*\)")

def format_line(line: str, name_width: int = 14, effect_width: int = 40) -> str:
    # Split first token (the word)
    parts = line.strip().split(maxsplit=1)
    if len(parts) < 2:
        return line  # invalid format
    name, rest = parts

    # Extract stack effects in parentheses
    effects = STACK_RE.findall(rest)
    effects_str = " ".join(effects)

    # Remaining text after the last parenthesis
    desc = rest
    for eff in effects:
        desc = desc.replace(eff, "")
    desc = desc.strip()

    # Formatting with padding
    name_field = name.ljust(name_width)
    effect_field = effects_str.ljust(effect_width)

    return f"{name_field} {effect_field} {desc}"


def format_comment(line: str) -> str:
    line = line[3:-2].strip() # Remove /** and */
    lines = line.splitlines()
    cleaned_lines = [l.lstrip().lstrip("*").strip() for l in lines]  # Remove leading * from each line
    line = " ".join(cleaned_lines)
    return format_line(line)


def extract_comments(files: list[str]) -> list[str]:
    result: list[str] = []
    for file_path in files:
        with open(file_path, "r", encoding="utf-8") as f:
            for match in COMMENT_RE.findall(f.read()):
                if "--" in match:  # Include only comments containing a -- (doble minus)
                    result.append(match)
    return result


def main():
    if len(sys.argv) < 2:
        print(f"Usage: python {sys.argv[0]} <file1> <file2> ...")
        sys.exit(1)

    files = sys.argv[1:]
    comments = extract_comments(files)
    words = sorted([format_comment(c) for c in comments])
    print("\n".join(words))

if __name__ == "__main__":
    main()
