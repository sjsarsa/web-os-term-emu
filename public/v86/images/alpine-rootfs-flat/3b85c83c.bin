#!/bin/bash

# ======================================================================
# Progress Tracking (auto-updated by game)
# ======================================================================
# SKILL 1: Navigating the filesystem
#   TASK 1: print_working_dir [ ]
#   TASK 2: go_to_subdir [ ]
#   TASK 3: go_to_subdir2 [ ]
#   TASK 4: to_parents [ ]
#   TASK 5: return_home [ ]
#   TASK 6: find_file [ ]
# SKILL 2: Managing files and folders
#   TASK 1: view_file_content [ ]
#   TASK 2: create_empty_file [ ]
#   TASK 3: create_file_with_text [ ]
#   TASK 4: create_dir [ ]
#   TASK 5: create_dirs [ ]
#   TASK 6: remove_file [ ]
#   TASK 7: remove_recursively [ ]
#   TASK 8: copy_file [ ]
#   TASK 9: copy_recursively [ ]
#   TASK 10: move [ ]
# SKILL 3: Wildcards, pipes and redirects
#   TASK 1: TODO
# SKILL 4: Modifying file and folder permissions TODO
#   TASK 1: make_executable [ ]
#   TASK 2: make_executables [ ]
# SKILL 5: Writing and executing simple scripts TODO
#   TASK 1: create_and_run_simple [ ]
#   TASK 2: create_and_run_ls [ ]
#   TASK 3: echo and redirect [ ]

# ======================================================================
# Colors
# ======================================================================
BOLD_YELLOW="\e[1;33m"
CYAN="\e[36m"
DIM="\e[2m"
RESET="\e[0m"

yello_bold=$'\e[1;33m'
cyan=$'\e[36m'
green_bold=$'\e[1;32m'
blue_bold=$'\e[1;34m'
red=$'\e[31m'
dim=$'\e[2m'
reset=$'\e[0m'

# ======================================================================
# Global Variables
# ======================================================================
GAME_DIR=""
SCRIPT_ABS_PATH=$(realpath "$0")
CURRENT_SKILL_ID=""
CURRENT_TASK_INDEX=-1
CURRENT_TASK_COMPLETED=0
LATEST_COMMAND_OUTPUT=""

# Randomized targets
declare -A TARGET_DIRS
declare -A TARGET_FILES
declare -A TARGET_SCRIPTS

declare -a SKILLS=(
)

# Revert to hard coding if dynamic reading fails on e.g. Git Bash
# Read dynamically from task definition comments below with grep
task_lines=$(grep -E '^# SKILL [0-9]+ - (\w+\s*)+$' $SCRIPT_ABS_PATH)
readarray -t SKILLS < <(echo "$task_lines" | sed -E 's|^# SKILL [0-9]+ - (.+)$|\1|')
num_skills=${#SKILLS[@]}

for i in $(seq 1 "$num_skills"); do
  declare -a "SKILL_${i}_TASKS=()"
done

for i in $(seq 1 "$num_skills"); do
  # Read tasks for this task
  task_lines=$(grep -E "^# SKILL $i - TASK [0-9] - (.+)$" "$SCRIPT_ABS_PATH" | sed -E "s|^# SKILL $i - TASK [0-9] - (.+)$|\1|")
  while IFS= read -r line; do
    eval "SKILL_${i}_TASKS+=(\"$line\")"
  done <<<"$task_lines"
done

# ======================================================================
# Utility / UI
# ======================================================================
print_separator() {
  echo ""
  # Use printf to repeat a character
  printf '%0.s=' $(seq 1 "$PRINT_WIDTH")
  echo ""
  echo ""
}

print_separator_thin() {
  echo ""
  printf '%0.s-' $(seq 1 "$PRINT_WIDTH")
  echo ""
  echo ""
}

# Mark task in this script file as completed (updates the header lines)
mark_task_completed() {
  local task_id=$1 sub_idx=$2 sub_name
  sub_name=$(get_current_task_name "$task_id" $((sub_idx - 1)))
  # Replace the specific task header line: [ ] -> [✔]
  sed -i "s|#   TASK ${sub_idx}: ${sub_name} \[ \]|#   TASK ${sub_idx}: ${sub_name} [✔]|" "$SCRIPT_ABS_PATH"
}

show_progress() {
  print_separator
  if [[ -z "$CURRENT_SKILL_ID" ]]; then
    echo "Skill Progress:"
    local i
    for i in "${!SKILLS[@]}"; do
      task_num=$((i + 1))
      if is_task_completed "$task_num"; then status="[✔]"; else status="[ ]"; fi
      echo "$status ${SKILLS[$i]}"
    done
  else
    echo "Task progress for ${SKILLS[$((CURRENT_SKILL_ID - 1))]}:"
    local tasks
    declare -n tasks="SKILL_${CURRENT_SKILL_ID}_TASKS"
    for i in "${!tasks[@]}"; do
      sub_num=$((i + 1))
      line="#   TASK ${sub_num}: ${tasks[i]} [✔]"
      if grep -qF "$line" "$SCRIPT_ABS_PATH"; then status="[✔]"; else status="[ ]"; fi
      echo "$sub_num. $status ${tasks[i]}"
    done
  fi
  print_separator
}

is_task_completed() {
  local task_id=$1
  local tasks
  declare -n tasks="SKILL_${task_id}_TASKS"

  local i
  for i in "${!tasks[@]}"; do
    sub_num=$((i + 1))
    line="#   TASK ${sub_num}: ${tasks[i]} [✔]"
    if ! grep -qF "$line" "$SCRIPT_ABS_PATH"; then
      return 1
    fi
  done
  return 0
}

# Utility to check if any path arguments in a command are outside the allowed base directory
outside_paths() {
  local base_dir="$1" # The "allowed" parent directory
  shift               # Remaining arguments are the command + args

  # Canonicalize base_dir
  base_dir="$(realpath -m "$base_dir")"

  for arg in "$@"; do
    # Detect arguments that look like paths (absolute or relative)
    if [[ "$arg" == /* || "$arg" == .* || "$arg" == */* ]]; then
      # Try to resolve the argument into a canonical absolute path
      if realpath_arg=$(realpath -m "$arg" 2>/dev/null); then
        # Check if it is under the allowed base_dir
        case "$realpath_arg" in
        "$base_dir"/*) ;; # OK (inside base_dir)
        "$base_dir") ;;   # OK (exactly base_dir)
        *)
          return 0 # Found a path outside base_dir
          ;;
        esac
      else
        # Skip if realpath fails
        continue
      fi
    fi
  done
  return 1 # No unallowed paths found
}

# ======================================================================
# Game Setup / Cleanup
# ======================================================================
setup_game() {
  clear
  PRINT_WIDTH=$((COLUMNS < 80 ? COLUMNS : 80))

  if [ "$DBG" == 1 ]; then
    echo "DEBUG: Detected ${#SKILLS[@]} skills from script comments."
    for i in "${!SKILLS[@]}"; do
      substarts_var="SKILL_$((i + 1))_TASKS[@]"
      echo "  $((i + 1)). ${SKILLS[$i]}"
      echo "    tasks:"
      echo "    ----------------"
      for task in "${!substarts_var}"; do
        echo "      - $task"
      done
    done
  fi

  print_separator
  echo "Welcome to the Bash Command Line Interactive Practice! 🚀"
  echo ""

  GAME_DIR=$(mktemp -d -t cmd-adventure-XXXXXXXX)
  if [[ ! -d "$GAME_DIR" ]]; then
    echo "Error: Could not create temporary directory. Exiting."
    exit 1
  fi
  HISTFILE=$(mktemp)
  HISTSIZE=1000
  HISTFILESIZE=2000

  echo "Game environment created at: $GAME_DIR"
  HOME="$GAME_DIR" # set home to game dir to avoid issues with ~
  cd "$GAME_DIR" || exit
}

# shellcheck disable=SC2329 # called in trap
cleanup() {
  print_separator
  echo "Cleaning up game environment..."
  cd /tmp || exit
  rm -rf "$GAME_DIR"
  echo "Done. Thanks for playing! 👋"
  print_separator
}

# ==============================================================================
# Course-like Instructions
# ==============================================================================

prompt_enter_or_q() {
  echo -ne "Press Enter to continue or q to exit..."
  read -r -n 1 -s key
  if [[ "$key" == "q" ]]; then
    echo ""
    return 1
  fi
  echo -e "\r\033[K"
  return 0
}

# shellcheck disable=SC2329
prompt_y_or_n() {
  echo -ne "$1 (y/n)? "
  while true; do
    read -r -n 1 -s key
    if [[ "$key" == "y" || "$key" == "Y" ]]; then
      echo -e "\r\033[K"
      return 0
    elif [[ "$key" == "n" || "$key" == "N" ]]; then
      echo -e "\r\033[K"
      return 1
    fi
  done
}

show_instructions() {
  print_separator
  case "$1" in
  "0")
    echo "General Command Line Instructions:

The command line is a text-based interface to interact with your computer.
You can navigate the filesystem, manage files and directories, and run
programs.

The basic structure of a command is the name of the command followed
by options (usually prefixed with '-' or '--') and arguments.
For example, in the command 'ls -1 . ..', 'ls' is the command, '-l' is an
option, and '.' and '..' are arguments.

Importantly, the command and its options and arguments are separated by
spaces. If we'd write 'ls-1', it would be interpreted as a single command
name, which likely doesn't exist. Similarly, the command 'ls -1 .,..' would
have a single argument '..,.'
"
    ;;
  "1")
    echo -e "
Navigating the Filesystem:

Nearly all filesystems today are hierarchical, meaning that files are organised into directories in tree-like structure. Such as:

${CYAN}/
├── home
│   └── user
│       ├── docs
│       ├── pics
│       └── music
└── system
    └── log
        ├── syslog
        └── auth.log${RESET}

We can move around and explore the file systems contents quickly using only a few command line commands."

    prompt_enter_or_q || return

    echo -e "A path in a filesystem specifies the location of a file or directory in the filesystem. It can be absolute (starting from the root, e.g., ${CYAN}/home/user/docs${RESET}) or relative (starting from the current working directory, e.g., ${CYAN}../docs/file.txt${RESET}). In Unix-like systems, paths use forward slashes (${CYAN}/${RESET}) to separate directories. In Windows, backslash (${CYAN}\\\\${RESET}) is the default path separator, although many Windows command line tools (such as PowerShell and Git Bash) accept forward slashes.

Special directory names:
  - The root of the filesystem is represented by a single forward slash (${CYAN}/${RESET}).
  - Your home directory is represented by a tilde (${CYAN}~${RESET}).
  - A single dot (${CYAN}.${RESET}) represents the current directory.
  - A double dot (${CYAN}..${RESET}) represents the parent directory (one level up)."

    prompt_enter_or_q || return

    echo -e "Common commands for navigation:
  - ${BOLD_YELLOW}pwd${RESET} (Print Working Directory): Shows you where you are.

  - ${BOLD_YELLOW}ls${RESET} (List): Shows what files and folders are in your current location.
      • Use ${CYAN}ls -1${RESET} to print one entry per line.
      • Use ${CYAN}ls -a${RESET} to include hidden files.
      • Options can be combined, e.g., ${CYAN}ls -1a${RESET}.

  - ${BOLD_YELLOW}cd [dir]${RESET} (Change Directory): Moves you to another folder specified by the given argument.
      • ${CYAN}cd${RESET} or ${CYAN}cd ~${RESET} moves you to your home directory.
        ${DIM}(In this game, your home directory is the same as the game root)${RESET}
      • ${CYAN}cd ..${RESET} moves you up one level.
      • ${CYAN}cd ../..${RESET} moves you up two levels.
      • ${CYAN}cd /${RESET} takes you to the root directory.

  - ${BOLD_YELLOW}find${RESET} (Find): Searches for files and directories in a directory hierarchy.
      • Use ${CYAN}find . -name 'filename'${RESET} to search for a file named 'filename' starting from the current directory (${CYAN}.${RESET}).
      • You can use wildcards, e.g., ${CYAN}find . -name '*.txt'${RESET} to find all text files.
  - ${BOLD_YELLOW}tree${RESET} (tree.com in Windows): Displays the directory structure in a tree-like format.
      • Great for getting a full overview.
      • ${DIM}NOTE: This command may not be installed by default on all systems.${RESET}
          - On Ubuntu/Debian: ${CYAN}sudo apt install tree${RESET}
          - On MacOS: ${CYAN}brew install tree${RESET}
          - On Windows Git Bash: not available, instead use Windows' ${CYAN}tree.com //f${RESET}
            (${CYAN}//f${RESET} shows files in the tree view).
  " | fold -s -w "$PRINT_WIDTH"
    ;;
  "2") echo -e "
Managing Files and Folders:

Files are used to store data (like documents, logs or executable scripts and programs), while directories are used to organise files into a hierarchical structure.

The command line lets you create, view, copy, move, and delete files or directories without much hassle.

    " | fold -s -w "$PRINT_WIDTH"

    prompt_enter_or_q || return

    echo -e "Common commands for managing files and folders:
  - ${BOLD_YELLOW}cat [file]${RESET} (Concatenate): Displays the contents of a file in the terminal.
      • Example: ${CYAN}cat notes.txt${RESET}

  - ${BOLD_YELLOW}touch [file]${RESET}: Creates a new, empty file. If the file already exists, its timestamp is updated.
      • Example: ${CYAN}touch newfile.txt${RESET}

  - ${BOLD_YELLOW}mkdir [dir]${RESET} (Make Directory): Creates a new, empty folder.
      • Example: ${CYAN}mkdir projects${RESET}

  - ${BOLD_YELLOW}echo 'text' > [file]${RESET}: Writes text into a file. If the file exists, its contents are overwritten.
      • Example: ${CYAN}echo 'Hello World' > hello.txt${RESET}
      • Use ${CYAN}>>${RESET} instead of ${CYAN}>${RESET} to append without overwriting.
  - ${BOLD_YELLOW}cp [src] [dest]${RESET} (Copy): Duplicates files or directories.
      • Example (file): ${CYAN}cp file.txt backup.txt${RESET}
      • Example (directory): ${CYAN}cp -r src_dir backup_dir${RESET}
        ${DIM}(The ${CYAN}-r${RESET} option copies directories recursively)${RESET}

  - ${BOLD_YELLOW}mv [src] [dest]${RESET} (Move): Moves or renames files and directories.
      • Example (rename): ${CYAN}mv oldname.txt newname.txt${RESET}
      • Example (move): ${CYAN}mv file.txt ~/docs/${RESET}

  - ${BOLD_YELLOW}rm [file]${RESET} (Remove): Deletes files permanently.
      • Example: ${CYAN}rm oldfile.txt${RESET}
      • Example (directory): ${CYAN}rm -r foldername${RESET}
        ${RED}${BOLD}Warning:${RESET} ${DIM}There is no recycle bin with rm — once deleted, files are gone!${RESET}

    " | fold -s -w "$PRINT_WIDTH"
    ;;
#   "3")
#     echo "Modifying File and Folder Permissions:
# Every file and folder has permissions that control who can read, write, or execute it. This is crucial for security.
#   - **chmod** (Change Mode): Changes file permissions. Permissions are represented in a three-digit octal number (e.g., 755).
#     - The first digit is for the **owner**.
#     - The second is for the **group**.
#     - The third is for **others**.
#     Each digit is a sum of: **4** (read), **2** (write), and **1** (execute). For example, 7 means '4+2+1' (read, write, execute).
#     'chmod +x filename' is a quick way to add execute permissions for everyone.
#   - **chown** (Change Owner): Changes the owner of a file or directory. Use 'chown newowner filename'. You might need admin/superuser privileges (sudo) to change ownership.
#     "
#     ;;
#   "4")
#     echo "Writing and Executing Simple Scripts:
# A shell script is a file containing a series of commands. They're used to automate repetitive tasks.
#   - **Creating a script**: Use 'echo >' or a text editor to write commands into a file.
#   - **Making it executable**: You must give a script execute permissions using 'chmod +x scriptname.sh'.
#   - **Running a script**: To run an executable script, you need to specify its path. If it's in the current directory, use './scriptname.sh'."
#     ;;
  esac
  print_separator
}

# ======================================================================
# task helpers
# ======================================================================

# Helper to fetch task name for the current task & index
get_current_task_name() {
  local tid=$1 idx=$2
  local tasks
  declare -n tasks="SKILL_${tid}_TASKS"
  if [[ "$idx" -ge 0 && "$idx" -lt "${#tasks[@]}" ]]; then
    echo "${tasks[$idx]}"
  else
    echo ""
  fi
}

get_task_count_for_task() {
  local tid=$1
  local tasks
  declare -n tasks="SKILL_${tid}_TASKS"
  echo "${#tasks[@]}"
}

# Run (explain/setup) current task
run_current_task() {
  local name
  name=$(get_current_task_name "$CURRENT_SKILL_ID" "$CURRENT_TASK_INDEX")
  if [[ -z "$name" ]]; then
    echo "No task available. Returning to main menu."
    CURRENT_SKILL_ID=""
    CURRENT_TASK_INDEX=-1
    main_menu
    return
  fi
  clear
  print_separator
  echo "Task $name ($((CURRENT_TASK_INDEX + 1)) of $(get_task_count_for_task "$CURRENT_SKILL_ID") for '${SKILLS[$((CURRENT_SKILL_ID - 1))]}'):"
  echo ""

  # ensure we are in game dir
  cd "$GAME_DIR" || exit

  "setup_$name"
  "explain_$name"
  echo "(When you're ready, run shell commands to complete the task.)"
  print_separator_thin
  echo "Enter the command 'help' to see all game commands."
  print_separator
  echo ""
}

# Check the currently active task and advance if completed
check_current_task() {
  if [[ -z "$CURRENT_SKILL_ID" || "$CURRENT_TASK_INDEX" -lt 0 ]]; then
    return
  fi
  local name
  name=$(get_current_task_name "$CURRENT_SKILL_ID" "$CURRENT_TASK_INDEX")
  if [[ -z "$name" ]]; then return; fi

  if "check_$name"; then
    # mark in script
    mark_task_completed "$CURRENT_SKILL_ID" $((CURRENT_TASK_INDEX + 1))
    CURRENT_TASK_COMPLETED=1

    print_separator
    echo "🎉 task '$name' completed!"
    show_progress

    # prompt for enter to continue

    # advance to next task
    local total
    total=$(get_task_count_for_task "$CURRENT_SKILL_ID")
    if [[ $((CURRENT_TASK_INDEX + 1)) -lt "$total" ]]; then
      # prepare next task
      cd "$GAME_DIR" || exit
      echo "You may now enter the command 'next' to continue to the next task."
    else
      echo "This was the final task for '${SKILLS[$((CURRENT_SKILL_ID - 1))]}'!"
      echo "You may now enter the command 'next' to return to the main menu."
    fi

    print_separator
  fi
}

# Helper for building a haystack for finding files
# shellcheck disable=SC2329
make_haystack() {
  local HAYSTACK_DIR=${1:-"./haystack"} # default dir unless provided
  local NUM_TOP_DIRS=${2:-7}            # default top-level dirs
  local MAX_DEPTH=${3:-4}               # max depth
  local FILES_PER_DIR=${4:-3}           # files per dir

  # Start fresh
  rm -rf "$HAYSTACK_DIR"
  mkdir -p "$HAYSTACK_DIR"

  # Recursive helper function
  create_random_tree() {
    local DIR=$1
    local DEPTH=$2

    # Create random files in this directory
    local NUM_FILES=$((RANDOM % FILES_PER_DIR + 1))
    for f in $(seq 1 "$NUM_FILES"); do
      EXTENSIONS=(txt log md conf csv dat)
      EXT=${EXTENSIONS[$RANDOM % ${#EXTENSIONS[@]}]}
      FILENAME="file$(printf "%03d" $f)_$(tr -dc 'a-z0-9' </dev/urandom | head -c 5).$EXT"
      echo "This is $FILENAME inside $DIR" >"$DIR/$FILENAME"
    done

    # Maybe create subdirectories (stop if max depth)
    if [ "$DEPTH" -lt "$MAX_DEPTH" ]; then
      local NUM_SUBDIRS=$((RANDOM % 4)) # up to 3 subdirs
      for s in $(seq 1 $NUM_SUBDIRS); do
        SUBDIR="$DIR/subdir$(tr -dc 'a-z0-9' </dev/urandom | head -c 3)"
        mkdir -p "$SUBDIR"
        create_random_tree "$SUBDIR" $((DEPTH + 1))
      done
    fi
  }

  # Build the top-level structure
  for d in $(seq 1 $NUM_TOP_DIRS); do
    DIR="$HAYSTACK_DIR/dir$d"
    mkdir -p "$DIR"
    create_random_tree "$DIR" 1
  done

  # Plant a "needle" file at random depth
  local NEEDLE_DIR
  NEEDLE_DIR="$HAYSTACK_DIR/dir$((RANDOM % NUM_TOP_DIRS + 1))"
  for i in $(seq 1 $((RANDOM % (MAX_DEPTH - 1) + 1))); do
    SUBDIRS=("$NEEDLE_DIR"/*/)
    # if * in SUBDIRS is not expanded, there are no subdirs
    # create one and break
    if [ "${SUBDIRS[0]}" == "$NEEDLE_DIR/*/" ]; then
      NEEDLE_DIR="$NEEDLE_DIR/subdir$(tr -dc 'a-z0-9' </dev/urandom | head -c 3)"
      break
    fi

    if [ ${#SUBDIRS[@]} -eq 0 ]; then break; fi
    NEEDLE_DIR="${SUBDIRS[RANDOM % ${#SUBDIRS[@]}]}"
  done

  mkdir -p "$NEEDLE_DIR"
  echo "SECRET_PASSWORD=opensesame" >"$NEEDLE_DIR/needle.txt"
  echo "${NEEDLE_DIR}" # return path to the needle file's directory
}

# ======================================================================
# task Implementations (each task has a setup and a check)
# Each setup should prepare the environment and tell the user what to do.
# Each check should return 0 when the user's actions satisfy the task.
# ======================================================================

##############################################
# SKILL 1 - Navigation
##############################################

# ============================================
# SKILL 1 - TASK 1 - print_working_dir
# ============================================
# shellcheck disable=SC2329
setup_print_working_dir() {
  random_suffix=$(shuf -i 100-999 -n 1)
  random_suffix2=$(shuf -i 100-999 -n 1)
  TARGET_DIRS[print_working_dir]="data_$random_suffix/users/user$random_suffix2"

  mkdir -p "$GAME_DIR/${TARGET_DIRS[print_working_dir]}"
  cd "$GAME_DIR/${TARGET_DIRS[print_working_dir]}" || exit
}

# shellcheck disable=SC2329
explain_print_working_dir() {
  echo "You are in the game root directory.
Enter the command that shows the full path of the directory you are currently in (hint: try entering the command 'info')." | fold -s -w "$PRINT_WIDTH"
}

# shellcheck disable=SC2329
check_print_working_dir() {
  [[ "$LATEST_COMMAND_OUTPUT" == "$GAME_DIR/${TARGET_DIRS[print_working_dir]}" ]]
}

# ============================================
# SKILL 1 - TASK 2 - go_to_subdir
# ============================================
# shellcheck disable=SC2329
setup_go_to_subdir() {
  TARGET_DIRS[go_to_subdir]="data_$(shuf -i 100-999 -n 1)"
  mkdir -p "${TARGET_DIRS[go_to_subdir]}/docs/archive"
}

# shellcheck disable=SC2329
explain_go_to_subdir() {
  echo "Go into the directory '${TARGET_DIRS[go_to_subdir]}' (use cd).
The directory was created under the game root." | fold -s -w "$PRINT_WIDTH"
}

# shellcheck disable=SC2329
check_go_to_subdir() {
  [[ "$(basename "$PWD")" == "${TARGET_DIRS[go_to_subdir]}" ]]
}

# ============================================
# SKILL 1 - TASK 3 - go_to_subdir2
# ============================================
# shellcheck disable=SC2329
setup_go_to_subdir2() {
  local i
  local subdir
  for i in $(seq 1 3); do
    subdir="data_$(shuf -i 100-999 -n 1)/docs"
    mkdir -p "$subdir"
    echo "nothing to see here..." >"$subdir/some_boring_data.txt"
  done

  TARGET_DIRS[go_to_subdir2]="data_$(shuf -i 100-999 -n 1)/docs/archive"
  mkdir -p "${TARGET_DIRS[go_to_subdir2]}"
  mkdir -p "${TARGET_DIRS[go_to_subdir2]}"
}

# shellcheck disable=SC2329
explain_go_to_subdir2() {
  echo "A new directory '${TARGET_DIRS[go_to_subdir2]}' has been created.
Tip: You can do this with a single 'cd' command.
Another tip: You can use tab completion for each subdirectory to easily construct a correct path argument for cd." | fold -s -w "$PRINT_WIDTH"
}

# shellcheck disable=SC2329
check_go_to_subdir2() {
  local expected_dir="$GAME_DIR/${TARGET_DIRS[go_to_subdir2]}"
  [[ "$PWD" == "$expected_dir" ]]
}

# ============================================
# SKILL 1 - TASK 4 - to_parents
# ============================================
# shellcheck disable=SC2329
setup_to_parents() {
  TARGET_DIRS[to_parents]="data_$(shuf -i 100-999 -n 1)"
  mkdir -p "${TARGET_DIRS[to_parents]}/docs/archive/subarchive"
  cd "${TARGET_DIRS[to_parents]}/docs/archive/subarchive" || exit
}

# shellcheck disable=SC2329
explain_to_parents() {
  echo "You are now deep inside a directory tree. Go back two levels until you reach the 'docs' directory. Tip: Use '..' with cd to go up one level." | fold -s -w "$PRINT_WIDTH"
}

# shellcheck disable=SC2329
check_to_parents() {
  [[ "$PWD" == "$GAME_DIR/${TARGET_DIRS[to_parents]}/docs" ]]
}

# ============================================
# SKILL 1 - TASK 5 - return_home
# ============================================
# shellcheck disable=SC2329
setup_return_home() {
  TARGET_DIRS[return_home]="data_$(shuf -i 100-999 -n 1)/docs/subarchive/some/shady/deeply/nested/directory"
  mkdir -p "${TARGET_DIRS[return_home]}"
  cd "${TARGET_DIRS[return_home]}" || exit
}

# shellcheck disable=SC2329
explain_return_home() {
  echo "You are now even deeper inside a directory tree. Return to your home directory (the game root).
  Tip: This can be done extremely easily, check the 'cd' instructions with the 'info' command or try 'cd --help' (most commands provide info on how to use it when provided the option '--help')." | fold -s -w "$PRINT_WIDTH"
}

# shellcheck disable=SC2329
check_return_home() {
  [[ "$PWD" == "$GAME_DIR" ]]
}

# ============================================
# SKILL 1 - TASK 5 - find_file
# ============================================
# shellcheck disable=SC2329
setup_find_file() {
  rm -rf "$GAME_DIR/haystack"
  TARGET_DIRS[find_file]=$(make_haystack "$GAME_DIR/haystack")
}

# shellcheck disable=SC2329
explain_find_file() {
  echo "A file named 'needle.txt' has been hidden somewhere inside the directory 'haystack'.
Navigate to the directory containing the file.

Tip: Use 'find -name <filename>' to locate it. " | fold -s -w "$PRINT_WIDTH"
}

# shellcheck disable=SC2329
check_find_file() {
  local expected_file="needle.txt"
  [[ "$PWD" == "${TARGET_DIRS[find_file]%/}" && -f "$expected_file" ]]
}

##############################################
# SKILL 2 - Managing files and folders
##############################################

# ============================================
# SKILL 2 - TASK 3 - view_file_content
# ============================================
# shellcheck disable=SC2329
setup_view_file_content() {
  TARGET_FILES[view_file_content]="cat-info.txt"
  echo "
  /\\_/\\
=( >.< )=
 /     \\

The cat command is short for 'concatenate'.
It reads files sequentially, writing them to standard output.

For example: cat file1.txt file2.txt

It is also the standard way to view the full contents of a file in the terminal.

Bonus:
  'less' is a pager program that allows you to view (but not change) the contents of a file one screen at a time. It is often much more convenient than cat for long files.
  Try 'less many-cats.txt' to see it in action.
" >"${TARGET_FILES[view_file_content]}"

  # long file with many cat ascii arts
  cat <<EOF >"many-cats.txt"
A few cat ASCII arts (source: https://www.asciiart.eu/animals/cats)

 /\_/\\
( o.o )
 > ^ <

           __..--''\`\`---....___   _..._    __
 /// //_.-'    .-/";  \`        \`\`<._  \`\`.''_ \`. / // /
///_.-' _..--.'_    \                    \`( ) ) // //
/ (_..-' // (< _     ;_..__               ; \`' / ///
 / // // //  \`-._,_)' // / \`\`--...____..-' /// / //

   |\---/|
   | ,_, |
    \_\`_/-..----.
 ___/ \`   ' ,""+ \  sk
(__...'   __\    |\`.___.';
  (_,...'(_,.\`__)/'.....+

  ,-.       _,---._ __  / \\
 /  )    .-'       \`./ /   \\
(  (   ,'            \`/    /|
 \  \`-"             \'\   / |
  \`.              ,  \ \ /  |
   /\`.          ,'-\`----Y   |
  (            ;        |   '
  |  ,-.    ,-'         |  /
  |  | (   |        hjw | /
  )  |  \  \`.___________|/
  \`--'   \`--'

                      (\`.-,')
                    .-'     ;
                _.-'   , \`,-
          _ _.-'     .'  /._
        .' \`  _.-.  /  ,'._;)
       (       .  )-| (
        )\`,_ ,'_,'  \_;)
('_  _,'.'  (___,))
 \`-:;.-'


  /\_/\  (
 ( ^.^ ) _)
   \"/  (
 ( | | )
(__d b__)


    /\_____/\
   /  o   o  \
  ( ==  ^  == )
   )         (
  (           )
 ( (  )   (  ) )
(__(__)___(__)__)


  ^___^
 " o o "
 ===X===       _
  ' " '_     __\\\\
 /''''  \___/ __/
|           /
("|")__\   |
"" ""(_____/

    |\__/,|   (\`\\
  _.|o o  |_   ) )
-(((---(((--------


 _._     _,-'""\`-._
(,-.\`._,'(       |\\\`-/|
    \`-.-' \\ )-\`( , o o)
          \`-    \\\`_\`"'-

 |\__/,|   (\`\\
 |_ _  |.--.) )
 ( T   )     /
(((^_(((/(((_/

EOF

}

# shellcheck disable=SC2329
explain_view_file_content() {
  echo "View the contents of the file '${TARGET_FILES[view_file_content]}' in the current directory.
Hint: Use the 'cat' command."
}

# shellcheck disable=SC2329
check_view_file_content() {
  # check if latest command output contains the expected text and is cat based on history
  [[ "$LATEST_COMMAND_OUTPUT" == *"The cat command is short for 'concatenate'."* ]] && [[ "$(history | tail -n 1)" =~ cat[[:space:]]+${TARGET_FILES[cat]} ]]
}

# ============================================
# SKILL 2 - TASK 1 - create_empty_file
# ============================================
# shellcheck disable=SC2329
setup_create_empty_file() {
  TARGET_FILES[create_empty_file]="report_$(shuf -i 100-999 -n 1).txt"
}

# shellcheck disable=SC2329
explain_create_empty_file() {
  echo "Create an empty file named '${TARGET_FILES[create_empty_file]}' in the game root. You can do this with the command 'touch'.
  Afterwards, verify that the file was created with ls." | fold -s -w "$PRINT_WIDTH"
}

# shellcheck disable=SC2329
check_create_empty_file() {
  [[ -f "$GAME_DIR/${TARGET_FILES[create_empty_file]}" ]] && [[ ! -s "$GAME_DIR/${TARGET_FILES[create_empty_file]}" ]] && [[ "$(history | tail -n 1)" =~ ls ]] && [[ ${LATEST_COMMAND_OUTPUT} == *"${TARGET_FILES[create_empty_file]}"* ]]
}

# ============================================
# SKILL 2 - TASK 2 - create_file_with_text
# ============================================
# shellcheck disable=SC2329
setup_create_file_with_text() {
  TARGET_FILES[create_file_with_text]="hello.txt"
}

# shellcheck disable=SC2329
explain_create_file_with_text() {
  echo "Create a new file '${TARGET_FILES[create_file_with_text]}' in the current directory containing the text: Hello my file!.

Once created, verify that the file contains the correct text with 'cat'.

Tip: Use one of:
  - (1) echo with redirection ('> filename')
  - (3) start a command line text editor with the filename as an argument, e.g. 'nano filename' or 'vim filename'
  - (2) create an empty file and open it with the system's default text editor ('open filename' on Linux/Mac, 'start filename' on Windows) — may not be available in all environments (e.g. servers).
    " | fold -s -w "$PRINT_WIDTH"
}

# shellcheck disable=SC2329
check_create_file_with_text() {
  [[ -f "$GAME_DIR/${TARGET_FILES[create_file_with_text]}" && "$(cat "$GAME_DIR/${TARGET_FILES[create_file_with_text]}")" == "Hello my file!" ]] && [[ "$(history | tail -n 1)" =~ cat ]] && [[ ${LATEST_COMMAND_OUTPUT} == "Hello my file!" ]]
}

# ============================================
# SKILL 2 - TASK 4 - create_dir
# ============================================
# shellcheck disable=SC2329
setup_create_dir() {
  TARGET_DIRS[create_dir]="project_$(shuf -i 100-999 -n 1)"
}

# shellcheck disable=SC2329
explain_create_dir() {
  echo "Create a new directory '${TARGET_DIRS[create_dir]}'.

Once created, verify that the directory was created with ls.

Tip: Use the 'mkdir' command." | fold -s -w "$PRINT_WIDTH"
}

# shellcheck disable=SC2329
check_create_dir() {
  [[ -d "$GAME_DIR/${TARGET_DIRS[create_dir]}" ]] && [[ "$(history | tail -n 1)" =~ ls ]] && [[ ${LATEST_COMMAND_OUTPUT} == *"${TARGET_DIRS[create_dir]}"* ]]
}

# ============================================
# SKILL 2 - TASK 5 - create_dirs
# ============================================
# shellcheck disable=SC2329
setup_create_dirs() {
  TARGET_DIRS[create_dirs]="project_$(shuf -i 100-999 -n 1)/tests/integration"
}

# shellcheck disable=SC2329
explain_create_dirs() {
  echo "Create a new directory '${TARGET_DIRS[create_dirs]}'

After this is done, verify it exists with 'find -name integration'.

Tip: You can create multiple nested directories in one command with the '-p' option of 'mkdir': 'mkdir -p <path>'." | fold -s -w "$PRINT_WIDTH"
}

# shellcheck disable=SC2329
check_create_dirs() {
  [[ -d "$GAME_DIR/${TARGET_DIRS[create_dirs]}" ]] && [[ "$(history | tail -n 1)" =~ find[[:space:]]+-name[[:space:]]+integration ]] && [[ ${LATEST_COMMAND_OUTPUT} == *"integration"* ]]
}

# ============================================
# SKILL 2 - TASK 6 - remove_file
# ============================================
# shellcheck disable=SC2329
setup_remove_file() {
  TARGET_DIRS[remove_file]="project_$(shuf -i 100-999 -n 1)"
  TARGET_FILES[remove_file]="notes.txt"
  mkdir -p "${TARGET_DIRS[remove_file]}"
  echo "These are some notes..." >"${TARGET_DIRS[remove_file]}/${TARGET_FILES[remove_file]}"
}

# shellcheck disable=SC2329
explain_remove_file() {
  echo "Delete the file '${TARGET_DIRS[remove_file]}/${TARGET_FILES[remove_file]}'. The directory should remain.

Tip: Use the 'rm' command

When not in the practice game, remember to be cautious with 'rm' — it deletes files permanently!." | fold -s -w "$PRINT_WIDTH"
}

# shellcheck disable=SC2329
check_remove_file() {
  [[ ! -f "$GAME_DIR/${TARGET_DIRS[remove_file]}/${TARGET_FILES[remove_file]}" && -d "$GAME_DIR/${TARGET_DIRS[remove_file]}" ]]
}

# ============================================
# SKILL 2 - TASK 7 - remove_recursively
# ============================================
# shellcheck disable=SC2329
setup_remove_recursively() {
  TARGET_DIRS[remove_recursively]="old_project_$(shuf -i 100-999 -n 1)"
  mkdir -p "${TARGET_DIRS[remove_recursively]}/docs"
  echo "Some old documentation..." >"${TARGET_DIRS[remove_recursively]}/docs/readme.txt"
}

# shellcheck disable=SC2329
explain_remove_recursively() {
  echo "Delete the entire directory '${TARGET_DIRS[remove_recursively]}' and its contents.

Tip: 'rm' can't remove directories by default. Use the 'rm' command with the '-r' option to recursively delete a directory and all its contents.

When not in the practice game, remember to be cautious with 'rm' — it deletes files permanently!" | fold -s -w "$PRINT_WIDTH"
}

# shellcheck disable=SC2329
check_remove_recursively() {
  [[ ! -d "$GAME_DIR/${TARGET_DIRS[remove_recursively]}" ]]
}

##############################################
# SKILL 2 - TASK 8 - copy_file
##############################################

# shellcheck disable=SC2329
setup_copy_file() {
  TARGET_DIRS[copy_file]="project_$(shuf -i 100-999 -n 1)"
  TARGET_FILES[copy_file_source]="report.txt"
  TARGET_FILES[copy_file_dest]="report_backup.txt"
  mkdir -p "${TARGET_DIRS[copy_file]}"
  echo "This is a report, yes." >"${TARGET_DIRS[copy_file]}/${TARGET_FILES[copy_file_source]}"
}

# shellcheck disable=SC2329
explain_copy_file() {
  echo "
The directory '${TARGET_DIRS[copy_file]}' contains a file named '${TARGET_FILES[copy_file_source]}' with the contents: This is a report, yes.

Create a copy of the file '${TARGET_FILES[copy_file_source]}' in '${TARGET_FILES[copy_file_dest]}' inside the same directory ${TARGET_DIRS[return_home]}.

Once done, verify that both files exist with 'ls'.
If you want to be extra sure, you can check the contents of both files with 'cat'.

Tip: Use the 'cp' command." | fold -s -w "$PRINT_WIDTH"
}

# shellcheck disable=SC2329
check_copy_file() {
  local expected_dir="$GAME_DIR/${TARGET_DIRS[copy_file]}"
  local source_path="$expected_dir/${TARGET_FILES[copy_file_source]}"
  local dest_path="$expected_dir/${TARGET_FILES[copy_file_dest]}"
  [[ -f "$source_path" && -f "$dest_path" ]] && diff "$source_path" "$dest_path" >/dev/null && [[ "$(history | tail -n 1)" =~ ls ]] && [[ ${LATEST_COMMAND_OUTPUT} == *"${TARGET_FILES[copy_file_source]}"* && ${LATEST_COMMAND_OUTPUT} == *"${TARGET_FILES[copy_file_dest]}"* ]]
}

##############################################
# TODO: SKILL 3 - Permissions
##############################################

# ============================================
# SKILL 3 - TASK 1 - make_executable
# ============================================
# shellcheck disable=SC2329
setup_make_executable() {
  TARGET_DIRS[make_executable]="secure_vault_$(shuf -i 100-999 -n 1)"
  mkdir -p "${TARGET_DIRS[make_executable]}"
  TARGET_FILES[make_executable]="${TARGET_DIRS[make_executable]}/locked.txt"
  touch "${TARGET_FILES[make_executable]}"
  chmod 600 "${TARGET_FILES[make_executable]}"
}

# shellcheck disable=SC2329
explain_make_executable() {
  echo "Make '${TARGET_FILES[make_executable]}' executable for everyone (hint: chmod +x).
Current mode has been set to 600 to make the change obvious."
}

# shellcheck disable=SC2329
check_make_executable() {
  [[ -x "$GAME_DIR/${TARGET_FILES[make_executable]}" ]] || [[ -x "${TARGET_FILES[make_executable]}" ]]
}

# ============================================
# SKILL 3 - TASK 2 - set_owner_permissions
# ============================================
# shellcheck disable=SC2329
setup_set_owner_permissions() {
  TARGET_DIRS[set_owner_permissions]="secure_vault_$(shuf -i 100-999 -n 1)"
  mkdir -p "${TARGET_DIRS[set_owner_permissions]}"
  TARGET_FILES[set_owner_permissions]="${TARGET_DIRS[set_owner_permissions]}/secret.sh"
  touch "${TARGET_FILES[set_owner_permissions]}"
  chmod 755 "${TARGET_FILES[set_owner_permissions]}"
}

# shellcheck disable=SC2329
explain_set_owner_permissions() {
  echo "Change permissions of '${TARGET_FILES[set_owner_permissions]}' to 700 (owner only)."
}

# shellcheck disable=SC2329
check_set_owner_permissions() {
  [[ "$(stat -c %a "$GAME_DIR/${TARGET_FILES[set_owner_permissions]}")" == "700" ]]
}

##############################################
# TODO: SKILL 4 - Scripts
##############################################

# ============================================
# SKILL 4 - TASK 1 - create_and_run_simple
# ============================================
# shellcheck disable=SC2329
setup_create_and_run_simple() {
  TARGET_SCRIPTS[create_and_run_simple]="myscript_$(shuf -i 100-999 -n 1).sh"
}

# shellcheck disable=SC2329
explain_create_and_run_simple() {
  echo "Create script '${TARGET_SCRIPTS[create_and_run_simple]}' that prints: Hello from script!
Make it executable and run it."
}

# shellcheck disable=SC2329
check_create_and_run_simple() {
  [[ -f "$GAME_DIR/${TARGET_SCRIPTS[create_and_run_simple]}" && -x "$GAME_DIR/${TARGET_SCRIPTS[create_and_run_simple]}" ]]
}

# ============================================
# SKILL 4 - TASK 2 - create_and_run_ls
# ============================================
# shellcheck disable=SC2329
setup_create_and_run_ls() {
  TARGET_SCRIPTS[create_and_run_ls]="list_files_$(shuf -i 100-999 -n 1).sh"
}

# shellcheck disable=SC2329
explain_create_and_run_ls() {
  echo "Create script '${TARGET_SCRIPTS[create_and_run_ls]}' that lists files (e.g. ls -la).
Make it executable and run it."
}

# shellcheck disable=SC2329
check_create_and_run_ls() {
  [[ -f "$GAME_DIR/${TARGET_SCRIPTS[create_and_run_ls]}" && -x "$GAME_DIR/${TARGET_SCRIPTS[create_and_run_ls]}" ]]
}

# ======================================================================
# Menu / Loop
# ======================================================================
main_menu() {
  print_separator
  echo "Choose a skill to practice:"
  local i
  for i in "${!SKILLS[@]}"; do
    task_num=$((i + 1))
    if is_task_completed "$task_num"; then status="[✔]"; else status="[ ]"; fi
    echo "$status $task_num. ${SKILLS[$i]}"
  done
  print_separator_thin
  echo "Type '<skill_number>', e.g. '1' to begin practicing a skill."
  echo "Type 'info' to see general instructions."
  echo "Type 'help' to see all game commands."
  echo "Type 'exit' to exit the game."
  echo ""
  echo "Press Enter to execute the typed command."
  print_separator
}

help() {
  echo "Available commands:"
  echo "  <number>        - Start practicing a skill (1-$task_num) (only in main menu)"
  echo "  info [<number>] - Show skill instructions (1-$task_num) or general command line
                    instructions (0) if no number is given"
  echo "  progress        - Show current progress"
  echo "  main-menu       - Go to main menu (will abandon current task if active)"
  echo "  help            - Show this help message"
  echo "  exit            - Exit the game"
  echo ""
  echo "Only while a task is active:"
  echo "  task-info       - Show the explanation that was shown when starting the task"
  echo "  begin-task <task-number> - Start a specific task within the current skill. Can be used to skip or repeat tasks."
  if [[ "$CURRENT_TASK_COMPLETED" -eq 1 ]]; then
    echo "  next            - Proceed to the next task (if any) or return to main menu"
  fi
  print_separator_thin
}

trap ctrl_c INT

# shellcheck disable=SC2329
function ctrl_c() {
  if prompt_y_or_n "Do you really want to exit the game"; then
    exit 0
  else
    # print game prompt again
    # TODO: fix cursor position
    printf "%s" "$(game_prompt)"
  fi
}

trap cleanup EXIT
setup_game
main_menu

game_prompt() {
  local base_prompt relpath
  if [[ -n "$CURRENT_SKILL_ID" && "$CURRENT_TASK_INDEX" -ge 0 ]]; then
    base_prompt="task $(get_current_task_name "$CURRENT_SKILL_ID" "$CURRENT_TASK_INDEX")"
  else
    base_prompt="bash-practice (main menu)"
  fi
  relpath=$(realpath --relative-to="$GAME_DIR" "$PWD")
  if [[ "$relpath" == "." ]]; then
    relpath="~"
  else
    # shellcheck disable=SC2088
    relpath="~/$relpath"
  fi
  echo -n "$green_bold$base_prompt$reset:$blue_bold$relpath$reset\$ "
}

while true; do
  # Update print width in case terminal was resized
  PRINT_WIDTH=$((COLUMNS < 80 ? COLUMNS : 80))

  # Prepare autocompletion for commands with dummy files
  commands="info progress main-menu help exit"
  task_commands="begin-task task-info"
  [[ -n "$CURRENT_SKILL_ID" && "$CURRENT_TASK_INDEX" -ge 0 && "$CURRENT_TASK_COMPLETED" -eq 1 ]] && task_commands="$task_commands next"
  touch $commands
  [[ -n "$CURRENT_SKILL_ID" ]] && touch $task_commands

  # printf "%s" "$GAME_PROMPT"
  read -e -p "$(game_prompt)" command

  history -s "$command"
  history -a
  case "$command" in
  exit)
    break
    ;;
  help)
    help
    ;;
  progress)
    show_progress
    ;;
  info\ [1-$num_skills])
    if [[ "$command" =~ ^info[[:space:]]+([1-4])$ ]]; then
      skill_id="${BASH_REMATCH[1]}"
      show_instructions "$skill_id"
    else
      if [[ -z "$CURRENT_SKILL_ID" ]]; then
        show_instructions "0"
      else
        show_instructions "$CURRENT_SKILL_ID"
      fi
    fi
    ;;
  info)
    if [[ -z "$CURRENT_SKILL_ID" ]]; then show_instructions "0"; else show_instructions "$CURRENT_SKILL_ID"; fi
    ;;
  [1-$num_skills])
    if [[ -n "$CURRENT_SKILL_ID" && "$CURRENT_TASK_INDEX" -ge 0 ]]; then
      if ! prompt_y_or_n "You are currently in a task. Do you want to abandon it and return to the main menu"; then
        continue
      else
        CURRENT_SKILL_ID=""
        CURRENT_TASK_INDEX=-1
        clear
        main_menu
        continue
      fi
    fi
    if [[ "$command" =~ ^[1-4]$ ]]; then
      CURRENT_SKILL_ID="$command"
      CURRENT_TASK_INDEX=0
      cd "$GAME_DIR" || exit
      run_current_task
    else
      echo "Invalid number. Choose 1-$num_skills."
    fi
    ;;
  begin-task\ [0-9]*)
    if [[ -n "$CURRENT_SKILL_ID" && "$CURRENT_TASK_INDEX" -ge 0 ]]; then
      if [[ "$command" =~ ^begin-task[[:space:]]+([0-9]+)$ ]]; then
        skip_to="$((BASH_REMATCH[1] - 1))"
        total=$(get_task_count_for_task "$CURRENT_SKILL_ID")
        if [[ "$skip_to" -ge 0 && "$skip_to" -lt "$total" ]]; then
          CURRENT_TASK_INDEX=$skip_to
          run_current_task
        else
          echo "Invalid task number to begin. Choose 1-$total."
        fi
      else
        echo "Invalid begin-task command. Use 'begin-task <task_number>', e.g. 'begin-task 1'."
      fi
    else
      echo "No active task to skip."
    fi
    ;;
  next)
    if [[ -n "$CURRENT_SKILL_ID" && "$CURRENT_TASK_INDEX" -ge 0 && "$CURRENT_TASK_COMPLETED" -eq 1 ]]; then
      CURRENT_TASK_COMPLETED=0
      total=$(get_task_count_for_task "$CURRENT_SKILL_ID")
      if [[ "$CURRENT_TASK_INDEX" -lt "$total" ]]; then
        CURRENT_TASK_INDEX=$((CURRENT_TASK_INDEX + 1))
        run_current_task
      else
        CURRENT_SKILL_ID=""
        CURRENT_TASK_INDEX=-1
        main_menu
      fi
      if [[ -f next && ! -s next ]]; then rm next; fi
    else
      echo "No completed task to proceed from."
    fi
    ;;
  task-info)
    name=$(get_current_task_name "$CURRENT_SKILL_ID" "$CURRENT_TASK_INDEX")
    if [[ -z "$name" ]]; then
      echo "No active task."
    else
      print_separator
      "explain_$name"
      print_separator
    fi
    ;;
  main-menu)
    CURRENT_SKILL_ID=""
    CURRENT_TASK_INDEX=-1
    clear
    main_menu
    ;;
  *)
    # Evaluate arbitrary shell commands in the game environment.
    if [[ -n "$command" ]]; then
      # If not in game dir do not eval but warn the user to cd into the game dir befor continuing
      if [[ "$PWD" != "$GAME_DIR"* ]]; then
        echo "You have left the game directory. Please 'cd $GAME_DIR' to return before continuing."
        continue
      fi

      # If any path arguments lead outside the game dir, do not eval but warn the user
      if outside_paths "$GAME_DIR" $command; then
        echo "Error: One or more path arguments given to the command lead to outside the game. Exit the game if you want to work outside the game."
        continue
      fi

      # Hide dummy autocompletion files (delete only if empty)
      for f in $commands $task_commands; do
        [[ -f "$f" && ! -s "$f" ]] && rm "$f"
      done

      # Add --color=always to commands that support it (like ls) to improve visibility
      if [[ "$command" =~ ^(ls)([[:space:]].*|$) ]]; then
        command="${BASH_REMATCH[1]} --color=always${BASH_REMATCH[2]}"
      fi
      if [[ "$command" =~ ^(tree)([[:space:]].*|$) ]]; then
        command="${BASH_REMATCH[1]} -C${BASH_REMATCH[2]}"
      fi

      # Execute the command

      # If not a known interactive command such as less or redirection, capture stdout and stderr, stripping bash line info from errors
      if [[ "$command" =~ ^(pager|less|nano|vi|vim|top|htop|man|>)([[:space:]].*|$) ]]; then
        eval "$command"
        LATEST_COMMAND_OUTPUT=""
      else
        tmp_output_file=$(mktemp)
        eval "$command" 2> >(sed -E "s|$0:\sline\s[0-9]+:\s||") >"$tmp_output_file"
        LATEST_COMMAND_OUTPUT=$(<"$tmp_output_file")
        if [[ -n "$LATEST_COMMAND_OUTPUT" ]]; then
          echo "$LATEST_COMMAND_OUTPUT"
        fi
        rm "$tmp_output_file"
      fi
    fi
    # After running the user's command, check whether they've completed the active task.
    if [[ -n "$CURRENT_SKILL_ID" ]]; then
      check_current_task
    fi
    ;;
  esac

done

exit 0
