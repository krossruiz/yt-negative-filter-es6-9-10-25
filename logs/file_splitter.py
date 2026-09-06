import os
import argparse

def split_file(file_path, num_parts):
    """
    Splits a file into a specified number of parts.

    Args:
        file_path (str): The path to the file to be split.
        num_parts (int): The number of parts to split the file into.
    """
    try:
        # Get the file name and extension
        dir_name, file_name_ext = os.path.split(file_path)
        file_name, file_ext = os.path.splitext(file_name_ext)

        # Create a new directory for the split files
        output_dir_name = f"SPLIT{num_parts}{file_name}"
        output_dir_path = os.path.join(dir_name, output_dir_name)
        os.makedirs(output_dir_path, exist_ok=True)
        print(f"Saving split files to: {output_dir_path}")

        with open(file_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()

        total_lines = len(lines)
        if total_lines == 0:
            print(f"The file '{file_path}' is empty. No parts will be created.")
            return

        lines_per_part = total_lines // num_parts
        remainder = total_lines % num_parts

        start_index = 0
        for i in range(1, num_parts + 1):
            # Distribute the remainder lines one by one to the first 'remainder' files
            part_size = lines_per_part + (1 if i <= remainder else 0)
            end_index = start_index + part_size

            part_content = lines[start_index:end_index]

            new_file_name = f"{file_name}part{i}of{num_parts}{file_ext}"
            new_file_path = os.path.join(output_dir_path, new_file_name)

            with open(new_file_path, 'w', encoding='utf-8') as part_file:
                part_file.writelines(part_content)

            print(f"Created part {i}: {new_file_path}")
            start_index = end_index

        print(f"\nSuccessfully split '{file_path}' into {num_parts} parts in directory '{output_dir_name}'.")

    except FileNotFoundError:
        print(f"Error: The file '{file_path}' was not found.")
    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Split a text file into multiple parts.",
        formatter_class=argparse.RawTextHelpFormatter
    )
    parser.add_argument("file_path", type=str, help="The path to the text file to split.")
    parser.add_argument("num_parts", type=int, help="The number of parts to split the file into.")

    args = parser.parse_args()

    if args.num_parts <= 0:
        print("Error: Number of parts must be a positive integer.")
    else:
        split_file(args.file_path, args.num_parts) 