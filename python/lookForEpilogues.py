import os

def get_all_files_in_folder(folder_path):
    files = []
    for root, dirs, filenames in os.walk(folder_path):
        for filename in filenames:
            files.append(os.path.join(root, filename))
            with open(os.path.join(root, filename), 'r', encoding='utf-8') as file:
                lines = file.readlines()
                for line in lines:
                    if line.strip() == "":
                        continue
                    else:
                        splitLine = line.split()
                        address = splitLine[0]
                        if "." not in address:
                            print(filename + " >> " + line)
    return files

folder_path = '../texts'
all_files = get_all_files_in_folder(folder_path)