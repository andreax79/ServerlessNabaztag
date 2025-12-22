#!/usr/bin/env python3

import sys
import re

MTL_COMMENT_RE = re.compile(r"/\*\*.*?\*/", re.DOTALL)
MTL_VAR_RE = re.compile(r'str:"([^"]+)"\s*.*?FORTH_MEMORY.*?//\s*(.+)$')
FORTH_VAR_RE  = re.compile(r'^variable\s+([A-Za-z0-9\-]+)\s+\\\s*(.+)$')
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


def format_variable(name: str, comment: str, name_width: int = 55) -> str:
   name = name.upper().ljust(name_width)
   return f"{name} {comment.strip()}"


def extract_words(files: list[str]) -> tuple[list[str], list[str]]:
    words: list[str] = []
    variables: list[str] = []
    for file_path in files:
        with open(file_path, "r", encoding="utf-8") as f:
            # Get the file extension
            file_extension = file_path.split(".")[-1].lower()
            if file_extension == "mtl":
                # Get the comments
                for match in MTL_COMMENT_RE.findall(f.read()):
                    if "--" in match:  # Include only comments containing a -- (doble minus)
                        words.append(format_comment(match))
                f.seek(0)
                # Get the variables
                for line in f.readlines():
                    match = MTL_VAR_RE.search(line)
                    if match:
                        variables.append(format_variable(match.group(1), match.group(2)))
            elif file_extension == "forth":
                for line in f.readlines():
                    if line.strip().startswith(": ") and "--" in line:
                        line = line[2:].strip().replace('\\', '')  # Remove leading ": " and backslashes
                        words.append(format_line(line))
                    match = FORTH_VAR_RE.search(line)
                    if match:
                        variables.append(format_variable(match.group(1), match.group(2)))
    words = sorted(words)
    variables = sorted(variables)
    return (words, variables)


def main():
    if len(sys.argv) < 2:
        print(f"Usage: python {sys.argv[0]} <file1> <file2> ...")
        sys.exit(1)

    files = sys.argv[1:]
    words, variables = extract_words(files)
    print("\n".join(words))
    print("\nVariables\n---------\n")
    print("\n".join(variables))

if __name__ == "__main__":
    main()
