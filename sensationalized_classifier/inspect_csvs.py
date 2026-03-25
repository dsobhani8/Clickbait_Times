#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import sys
from collections import Counter
from pathlib import Path


DEFAULT_DATA_DIR = Path(__file__).resolve().parent / "us_news_articles"


def configure_csv_field_limit() -> None:
    limit = sys.maxsize
    while True:
        try:
            csv.field_size_limit(limit)
            return
        except OverflowError:
            limit //= 10


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Inspect the CSV files in the US news article dataset."
    )
    parser.add_argument(
        "--data-dir",
        type=Path,
        default=DEFAULT_DATA_DIR,
        help=f"Directory containing CSV files (default: {DEFAULT_DATA_DIR})",
    )
    parser.add_argument(
        "--file",
        help="Inspect one CSV file in detail. Accepts an exact filename or a unique substring.",
    )
    parser.add_argument(
        "--columns",
        action="store_true",
        help="Print only the column names for the selected CSV file.",
    )
    parser.add_argument(
        "--sample-rows",
        type=int,
        default=2,
        help="Number of data rows to print in detailed mode (default: 2)",
    )
    parser.add_argument(
        "--scan-rows",
        type=int,
        default=200,
        help="Number of data rows to scan for per-column stats in detailed mode (default: 200)",
    )
    parser.add_argument(
        "--count-rows",
        action="store_true",
        help="Count all data rows in detailed mode. This can take time on large files.",
    )
    parser.add_argument(
        "--read-headers",
        action="store_true",
        help="Read header rows for all CSV files in summary mode. This may be slow on cloud-backed files.",
    )
    parser.add_argument(
        "--max-width",
        type=int,
        default=100,
        help="Maximum width for printed cell values (default: 100)",
    )
    return parser.parse_args()


def human_size(size_bytes: int) -> str:
    units = ["B", "KB", "MB", "GB", "TB"]
    size = float(size_bytes)
    for unit in units:
        if size < 1024 or unit == units[-1]:
            return f"{size:.1f} {unit}"
        size /= 1024
    return f"{size_bytes} B"


def display_name(header: str, index: int) -> str:
    return header if header else f"<unnamed_{index}>"


def clip(value: str, max_width: int) -> str:
    text = value.replace("\n", "\\n").replace("\r", "\\r")
    if len(text) <= max_width:
        return text
    return text[: max_width - 3] + "..."


def csv_files(data_dir: Path) -> list[Path]:
    return sorted(
        path for path in data_dir.iterdir() if path.is_file() and path.suffix.lower() == ".csv"
    )


def read_header(path: Path) -> list[str]:
    with path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.reader(handle)
        return next(reader, [])


def resolve_target(files: list[Path], file_arg: str) -> Path:
    exact_matches = [path for path in files if path.name == file_arg]
    if exact_matches:
        return exact_matches[0]

    partial_matches = [path for path in files if file_arg in path.name]
    if len(partial_matches) == 1:
        return partial_matches[0]
    if not partial_matches:
        raise SystemExit(f"No CSV file matched '{file_arg}'.")

    names = ", ".join(path.name for path in partial_matches[:10])
    suffix = "" if len(partial_matches) <= 10 else ", ..."
    raise SystemExit(f"'{file_arg}' matched multiple files: {names}{suffix}")


def print_summary(files: list[Path], read_headers: bool) -> None:
    print(f"Data directory: {files[0].parent}" if files else "Data directory: <empty>")
    print(f"CSV files: {len(files)}")

    summaries: list[tuple[Path, list[str] | None]] = []

    if read_headers:
        schemas = Counter()
        for path in files:
            header = read_header(path)
            summaries.append((path, header))
            schemas[tuple(header)] += 1

        print(f"Distinct schemas: {len(schemas)}")
        if schemas:
            common_schema, count = schemas.most_common(1)[0]
            print(f"Most common schema: {count} file(s), {len(common_schema)} columns")
            for index, column in enumerate(common_schema):
                print(f"  {index + 1:>2}. {display_name(column, index)}")
    else:
        print("Header inspection: skipped")
        print("Use --read-headers for all files or --file <name> for one file.")
        summaries = [(path, None) for path in files]

    print()
    print("Files:")
    for path, header in summaries:
        column_text = f"{len(header):>2} cols" if header is not None else "--"
        print(f"  {path.name:<32}  {human_size(path.stat().st_size):>9}  {column_text}")


def print_detailed_report(
    path: Path, sample_rows: int, scan_rows: int, count_rows: bool, max_width: int
) -> None:
    with path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.reader(handle)
        header = next(reader, [])

        samples: list[list[str]] = []
        row_widths: Counter[int] = Counter()
        scan_limit = max(sample_rows, scan_rows)
        total_rows = 0
        scanned_rows = 0
        stats = [
            {
                "non_empty": 0,
                "max_length": 0,
                "example": "",
            }
            for _ in header
        ]

        for row in reader:
            total_rows += 1
            row_widths[len(row)] += 1

            if len(samples) < sample_rows:
                samples.append(row)

            if scanned_rows < scan_rows:
                scanned_rows += 1
                for index in range(len(header)):
                    value = row[index] if index < len(row) else ""
                    if value.strip():
                        stats[index]["non_empty"] += 1
                        stats[index]["max_length"] = max(
                            stats[index]["max_length"], len(value)
                        )
                        if not stats[index]["example"]:
                            stats[index]["example"] = value

            if not count_rows and total_rows >= scan_limit:
                break

    print(f"File: {path}")
    print(f"Size: {human_size(path.stat().st_size)}")
    print(f"Columns: {len(header)}")
    for index, column in enumerate(header):
        print(f"  {index + 1:>2}. {display_name(column, index)}")

    print()
    if count_rows:
        print(f"Total data rows: {total_rows}")
    else:
        print(f"Scanned data rows: {total_rows}")
        if total_rows >= scan_limit:
            print("Full row count: skipped (use --count-rows to count the whole file)")

    if row_widths:
        print("Observed row widths:")
        for width, count in sorted(row_widths.items()):
            print(f"  {width:>2} columns: {count} row(s)")

    print()
    print("Sample rows:")
    if not samples:
        print("  <no data rows>")
    for sample_index, row in enumerate(samples, start=1):
        print(f"  Row {sample_index}:")
        for index, column in enumerate(header):
            value = row[index] if index < len(row) else ""
            print(
                f"    {display_name(column, index)}: {clip(value, max_width)}"
            )

    print()
    print(f"Per-column stats from first {scanned_rows} data row(s):")
    for index, column in enumerate(header):
        example = clip(stats[index]["example"], max_width) if stats[index]["example"] else "<empty>"
        print(
            "  "
            f"{display_name(column, index):<22} "
            f"non-empty={stats[index]['non_empty']:>4}/{scanned_rows:<4} "
            f"max_len={stats[index]['max_length']:<6} "
            f"example={example}"
        )


def print_columns(path: Path) -> None:
    header = read_header(path)
    for index, column in enumerate(header, start=1):
        print(f"{index:>2}. {display_name(column, index - 1)}")


def main() -> None:
    configure_csv_field_limit()
    args = parse_args()
    data_dir = args.data_dir.expanduser().resolve()

    if not data_dir.exists():
        raise SystemExit(f"Data directory does not exist: {data_dir}")
    if not data_dir.is_dir():
        raise SystemExit(f"Data directory is not a directory: {data_dir}")

    files = csv_files(data_dir)
    if not files:
        raise SystemExit(f"No CSV files found in: {data_dir}")

    if args.file:
        target = resolve_target(files, args.file)
        if args.columns:
            print_columns(target)
            return
        print_detailed_report(
            target,
            sample_rows=max(args.sample_rows, 0),
            scan_rows=max(args.scan_rows, 0),
            count_rows=args.count_rows,
            max_width=max(args.max_width, 20),
        )
        return

    print_summary(files, read_headers=args.read_headers)


if __name__ == "__main__":
    main()
