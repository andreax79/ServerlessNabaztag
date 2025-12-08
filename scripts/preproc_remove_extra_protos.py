#!/usr/bin/env python3
import re
import sys

# Removes "proto" declarations that are after the actual function
# definition. The compile handles that badly.

FUN_RE = re.compile(r"^fun ([a-zA-Z0-9_-]+)")
PROTO_RE = re.compile(r"^proto ([a-zA-Z0-9_-]+)")

def main():
    if len(sys.argv) < 2:
        input_file = sys.stdin
    else:
        try:
            input_file = open(sys.argv[1], "r")
        except Exception:
            sys.stderr.write(f"Could not open {sys.argv[1]}\n")
            sys.exit(1)

    try:
        funs = set()
        for line in input_file:
            fun_match = FUN_RE.search(line)
            if fun_match:
                funs.add(fun_match.group(1))
            else:
                proto_match = PROTO_RE.search(line)
                if proto_match:
                    if proto_match.group(1) in funs:
                        sys.stdout.write("//")
                    else:
                        funs.add(proto_match.group(1))

            sys.stdout.write(line)

    finally:
        if input_file is not sys.stdin:
            input_file.close()


if __name__ == "__main__":
    main()
