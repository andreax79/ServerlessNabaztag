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
    tmp = name.upper().ljust(name_width) + " " + effects_str
    return (tmp.ljust(effect_width + 1 + name_width) + " " + desc).strip()


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
            # get file extension
            file_extension = file_path.split(".")[-1].lower()
            if file_extension == "mtl":
                for match in COMMENT_RE.findall(f.read()):
                    if "--" in match:  # Include only comments containing a -- (doble minus)
                        result.append(format_comment(match))
            elif file_extension == "forth":
                for line in f.readlines():
                    if line.strip().startswith(": ") and "--" in line:
                        line = line[2:].strip().replace('\\', '')  # Remove leading ": " and backslashes
                        result.append(format_line(line))
    return result


def main():
    if len(sys.argv) < 2:
        print(f"Usage: python {sys.argv[0]} <file1> <file2> ...")
        sys.exit(1)

    files = sys.argv[1:]
    words = sorted(extract_comments(files))
    print("\n".join(words))

if __name__ == "__main__":
    main()
