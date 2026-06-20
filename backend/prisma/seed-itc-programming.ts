import { BloomLevel, Difficulty } from "@prisma/client";
import { ITC_12_TOPICS } from "./seed-itc-12-questions.js";
import { BLOOM_LEVEL_ORDER, difficultyForBloomLevel } from "../src/lib/bloomLevel.js";

export type DemoQuestion = {
  text: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: string;
  difficulty: Difficulty;
  bloomLevel?: BloomLevel;
};

export type DemoQuestionDraft = Omit<DemoQuestion, "difficulty" | "bloomLevel">;

export type DemoTopic = {
  name: string;
  questions: DemoQuestion[];
};

export type ItcDemoSubject = {
  courseCode: string;
  courseTitle: string;
  curriculumYear: number;
  topics: DemoTopic[];
};

export type DomainQuestionSet = Record<
  BloomLevel,
  [DemoQuestionDraft, DemoQuestionDraft, DemoQuestionDraft]
>;

function topicQuestions(questions: DemoQuestion[]): DemoTopic["questions"] {
  return questions;
}

/** Three demo questions per Bloom domain (L1–L6) for exam pool validation. */
export function threePerDomainQuestions(byDomain: DomainQuestionSet): DemoQuestion[] {
  return BLOOM_LEVEL_ORDER.flatMap((bloomLevel) =>
    byDomain[bloomLevel].map((question) => ({
      ...question,
      bloomLevel,
      difficulty: difficultyForBloomLevel(bloomLevel),
    }))
  );
}

export function demoTopic(name: string, byDomain: DomainQuestionSet): DemoTopic {
  return { name, questions: threePerDomainQuestions(byDomain) };
}

export function q(
  text: string,
  optionA: string,
  optionB: string,
  optionC: string,
  optionD: string,
  correctOption: string
): DemoQuestionDraft {
  return {
    text: `[Demo] ${text}`,
    optionA,
    optionB,
    optionC,
    optionD,
    correctOption,
  };
}

/** IT Year 2 programming subjects — C++ (ITC 12) and Python (ITC 13). */
export const ITC_DEMO_SUBJECTS: ItcDemoSubject[] = [
  {
    courseCode: "ITC 12",
    courseTitle: "Computer Programming 1",
    curriculumYear: 1,
    topics: ITC_12_TOPICS,
  },
  {
    courseCode: "ITC 13",
    courseTitle: "Computer Programming 2",
    curriculumYear: 1,
    topics: [
      {
        name: "Variables",
        questions: topicQuestions([
          {
            text: "[Demo] Which Python statement assigns 10 to variable x?",
            optionA: "x := 10",
            optionB: "x = 10",
            optionC: "int x = 10",
            optionD: "var x 10",
            correctOption: "B",
            difficulty: Difficulty.EASY,
          },
          {
            text: "[Demo] Which is a valid Python variable name?",
            optionA: "2score",
            optionB: "score_total",
            optionC: "score-total",
            optionD: "class",
            correctOption: "B",
            difficulty: Difficulty.EASY,
          },
          {
            text: "[Demo] What is the type of `3.14` in Python?",
            optionA: "int",
            optionB: "float",
            optionC: "str",
            optionD: "bool",
            correctOption: "B",
            difficulty: Difficulty.MEDIUM,
          },
          {
            text: "[Demo] After `count = 4; count += 2`, what is count?",
            optionA: "42",
            optionB: "6",
            optionC: "2",
            optionD: "8",
            correctOption: "B",
            difficulty: Difficulty.MEDIUM,
          },
          {
            text: "[Demo] In Python, reassigning `name = \"Ana\"` to `name = \"Ben\"` shows that variables:",
            optionA: "Are fixed at compile time only",
            optionB: "Can refer to different values over time",
            optionC: "Must always be integers",
            optionD: "Cannot hold strings",
            correctOption: "B",
            difficulty: Difficulty.HARD,
          },
          {
            text: "[Demo] Using meaningful names like `student_count` instead of `x` improves:",
            optionA: "Syntax errors only",
            optionB: "Code readability and maintenance",
            optionC: "Python version number",
            optionD: "Memory size always",
            correctOption: "B",
            difficulty: Difficulty.HARD,
          },
        ]),
      },
      {
        name: "Data Types",
        questions: topicQuestions([
          {
            text: "[Demo] Which Python literal is a list?",
            optionA: "(1, 2, 3)",
            optionB: "[1, 2, 3]",
            optionC: "{1, 2, 3}",
            optionD: "<1, 2, 3>",
            correctOption: "B",
            difficulty: Difficulty.EASY,
          },
          {
            text: "[Demo] Which type represents True or False in Python?",
            optionA: "bool",
            optionB: "bit",
            optionC: "logic",
            optionD: "binary",
            correctOption: "A",
            difficulty: Difficulty.EASY,
          },
          {
            text: "[Demo] What does `len([10, 20, 30])` return?",
            optionA: "30",
            optionB: "3",
            optionC: "10",
            optionD: "6",
            correctOption: "B",
            difficulty: Difficulty.MEDIUM,
          },
          {
            text: "[Demo] Which creates a dictionary mapping \"id\" to 101?",
            optionA: "{\"id\": 101}",
            optionB: "[\"id\", 101]",
            optionC: "(\"id\", 101)",
            optionD: "dict(id, 101)",
            correctOption: "A",
            difficulty: Difficulty.MEDIUM,
          },
          {
            text: "[Demo] Slicing `text[1:4]` on `text = \"Python\"` returns:",
            optionA: "Pyt",
            optionB: "yth",
            optionC: "ytho",
            optionD: "hon",
            correctOption: "B",
            difficulty: Difficulty.HARD,
          },
          {
            text: "[Demo] A tuple differs from a list because a tuple is:",
            optionA: "Mutable and ordered",
            optionB: "Immutable and ordered",
            optionC: "Unordered and mutable",
            optionD: "Always empty",
            correctOption: "B",
            difficulty: Difficulty.HARD,
          },
        ]),
      },
      {
        name: "Conditions",
        questions: topicQuestions([
          {
            text: "[Demo] Which Python keyword starts a conditional?",
            optionA: "when",
            optionB: "if",
            optionC: "switch",
            optionD: "case",
            correctOption: "B",
            difficulty: Difficulty.EASY,
          },
          {
            text: "[Demo] Which comparison checks equality in Python?",
            optionA: "=",
            optionB: "==",
            optionC: "===",
            optionD: ":=",
            correctOption: "B",
            difficulty: Difficulty.EASY,
          },
          {
            text: "[Demo] What does `elif` allow?",
            optionA: "Another condition after if/else chain",
            optionB: "Infinite loops only",
            optionC: "Importing modules",
            optionD: "Defining classes",
            correctOption: "A",
            difficulty: Difficulty.MEDIUM,
          },
          {
            text: "[Demo] Which expression is True when age is at least 18?",
            optionA: "age > 18",
            optionB: "age >= 18",
            optionC: "age = 18",
            optionD: "age != 18",
            correctOption: "B",
            difficulty: Difficulty.MEDIUM,
          },
          {
            text: "[Demo] `if not logged_in:` runs its block when logged_in is:",
            optionA: "True",
            optionB: "False",
            optionC: "A string only",
            optionD: "Always skipped",
            correctOption: "B",
            difficulty: Difficulty.HARD,
          },
          {
            text: "[Demo] Chaining `if score >= 90: grade = 'A'` with lower thresholds is an example of:",
            optionA: "Multi-branch grading logic",
            optionB: "Exception handling",
            optionC: "List comprehension",
            optionD: "File I/O",
            correctOption: "A",
            difficulty: Difficulty.HARD,
          },
        ]),
      },
      {
        name: "Loops",
        questions: topicQuestions([
          {
            text: "[Demo] Which Python loop iterates over each item in a list?",
            optionA: "for item in items:",
            optionB: "loop item from items:",
            optionC: "foreach item in items:",
            optionD: "repeat item in items:",
            correctOption: "A",
            difficulty: Difficulty.EASY,
          },
          {
            text: "[Demo] Which loop repeats while a condition is true?",
            optionA: "for",
            optionB: "while",
            optionC: "do",
            optionD: "until",
            correctOption: "B",
            difficulty: Difficulty.EASY,
          },
          {
            text: "[Demo] What does `range(3)` produce?",
            optionA: "1, 2, 3",
            optionB: "0, 1, 2",
            optionC: "3, 2, 1",
            optionD: "0, 1, 2, 3",
            correctOption: "B",
            difficulty: Difficulty.MEDIUM,
          },
          {
            text: "[Demo] `break` inside a loop:",
            optionA: "Skips one iteration",
            optionB: "Exits the loop entirely",
            optionC: "Restarts Python",
            optionD: "Converts to a list",
            correctOption: "B",
            difficulty: Difficulty.MEDIUM,
          },
          {
            text: "[Demo] A nested loop printing a multiplication table uses nested loops because:",
            optionA: "Each row needs iteration over columns",
            optionB: "Python forbids single loops",
            optionC: "while cannot print numbers",
            optionD: "range is unavailable",
            correctOption: "A",
            difficulty: Difficulty.HARD,
          },
          {
            text: "[Demo] `continue` in a loop:",
            optionA: "Stops the entire program",
            optionB: "Skips to the next iteration",
            optionC: "Deletes the list",
            optionD: "Defines a function",
            correctOption: "B",
            difficulty: Difficulty.HARD,
          },
        ]),
      },
      {
        name: "Functions",
        questions: topicQuestions([
          {
            text: "[Demo] Which keyword defines a function in Python?",
            optionA: "function",
            optionB: "def",
            optionC: "fn",
            optionD: "func",
            correctOption: "B",
            difficulty: Difficulty.EASY,
          },
          {
            text: "[Demo] What does `return` do in a Python function?",
            optionA: "Imports a module",
            optionB: "Sends a value back to the caller",
            optionC: "Starts a loop",
            optionD: "Deletes parameters",
            correctOption: "B",
            difficulty: Difficulty.EASY,
          },
          {
            text: "[Demo] Calling `greet(\"Mia\")` passes \"Mia\" as:",
            optionA: "A return value",
            optionB: "An argument",
            optionC: "A global variable",
            optionD: "A module name",
            correctOption: "B",
            difficulty: Difficulty.MEDIUM,
          },
          {
            text: "[Demo] A default parameter like `def show(msg=\"Hello\")` allows:",
            optionA: "Calling show() without arguments",
            optionB: "Only recursive calls",
            optionC: "No arguments ever",
            optionD: "Compile-time only binding",
            correctOption: "A",
            difficulty: Difficulty.MEDIUM,
          },
          {
            text: "[Demo] A function that calculates average should:",
            optionA: "Modify unrelated globals only",
            optionB: "Accept inputs and return the computed average",
            optionC: "Never use return",
            optionD: "Print and crash",
            correctOption: "B",
            difficulty: Difficulty.HARD,
          },
          {
            text: "[Demo] Using `*args` in a function definition allows:",
            optionA: "A variable number of positional arguments",
            optionB: "Only keyword arguments",
            optionC: "No parameters",
            optionD: "Importing tkinter",
            correctOption: "A",
            difficulty: Difficulty.HARD,
          },
        ]),
      },
      {
        name: "Objects",
        questions: topicQuestions([
          {
            text: "[Demo] In Python, an object is created from:",
            optionA: "A class",
            optionB: "A comment",
            optionC: "A loop",
            optionD: "A shebang line",
            correctOption: "A",
            difficulty: Difficulty.EASY,
          },
          {
            text: "[Demo] Which creates a `Student` object?",
            optionA: "Student()",
            optionB: "new Student",
            optionC: "create Student",
            optionD: "object Student",
            correctOption: "A",
            difficulty: Difficulty.EASY,
          },
          {
            text: "[Demo] Instance attributes belong to:",
            optionA: "Each object individually",
            optionB: "Only the Python interpreter",
            optionC: "Comments in the file",
            optionD: "Import statements",
            correctOption: "A",
            difficulty: Difficulty.MEDIUM,
          },
          {
            text: "[Demo] `self` in a method refers to:",
            optionA: "The current instance",
            optionB: "The main module only",
            optionC: "A built-in function",
            optionD: "A random number",
            correctOption: "A",
            difficulty: Difficulty.MEDIUM,
          },
          {
            text: "[Demo] Setting attributes in `__init__` ensures:",
            optionA: "Objects start with required state",
            optionB: "All methods become static",
            optionC: "The class cannot be reused",
            optionD: "GUI windows open automatically",
            correctOption: "A",
            difficulty: Difficulty.HARD,
          },
          {
            text: "[Demo] Two instances of the same class:",
            optionA: "Share the same attribute values always",
            optionB: "Can hold different attribute values",
            optionC: "Cannot call methods",
            optionD: "Are the same object",
            correctOption: "B",
            difficulty: Difficulty.HARD,
          },
        ]),
      },
      {
        name: "OOP",
        questions: topicQuestions([
          {
            text: "[Demo] A class in Python is:",
            optionA: "A blueprint for creating objects",
            optionB: "A type of loop",
            optionC: "A syntax error",
            optionD: "A GUI widget only",
            correctOption: "A",
            difficulty: Difficulty.EASY,
          },
          {
            text: "[Demo] Inheritance allows a child class to:",
            optionA: "Reuse and extend a parent class",
            optionB: "Delete all methods",
            optionC: "Avoid defining any attributes",
            optionD: "Run without objects",
            correctOption: "A",
            difficulty: Difficulty.EASY,
          },
          {
            text: "[Demo] Method overriding means:",
            optionA: "A subclass provides its own version of a method",
            optionB: "Removing all parent methods",
            optionC: "Using only global functions",
            optionD: "Importing tkinter",
            correctOption: "A",
            difficulty: Difficulty.MEDIUM,
          },
          {
            text: "[Demo] Encapsulation in Python often uses:",
            optionA: "Leading underscore naming conventions",
            optionB: "Deleting __init__",
            optionC: "Only tuples",
            optionD: "No attributes",
            correctOption: "A",
            difficulty: Difficulty.MEDIUM,
          },
          {
            text: "[Demo] If `Animal` defines `speak()` and `Dog` overrides it, calling `speak()` on a Dog object uses:",
            optionA: "Dog's implementation",
            optionB: "No method at all",
            optionC: "Only Animal's version always",
            optionD: "The main function",
            correctOption: "A",
            difficulty: Difficulty.HARD,
          },
          {
            text: "[Demo] Polymorphism lets code:",
            optionA: "Treat different object types through a common interface",
            optionB: "Avoid classes entirely",
            optionC: "Disable methods",
            optionD: "Run only in the shell",
            correctOption: "A",
            difficulty: Difficulty.HARD,
          },
        ]),
      },
      {
        name: "GUI",
        questions: topicQuestions([
          {
            text: "[Demo] Which Python module is commonly used for basic GUI windows?",
            optionA: "tkinter",
            optionB: "sqlite3",
            optionC: "math",
            optionD: "os",
            correctOption: "A",
            difficulty: Difficulty.EASY,
          },
          {
            text: "[Demo] In tkinter, the main window is usually created with:",
            optionA: "Tk()",
            optionB: "Window.new()",
            optionC: "GUI()",
            optionD: "Form()",
            correctOption: "A",
            difficulty: Difficulty.EASY,
          },
          {
            text: "[Demo] `mainloop()` in tkinter:",
            optionA: "Starts the event loop for the window",
            optionB: "Deletes all widgets",
            optionC: "Compiles Python to C",
            optionD: "Closes the terminal",
            correctOption: "A",
            difficulty: Difficulty.MEDIUM,
          },
          {
            text: "[Demo] A Button widget in tkinter typically needs:",
            optionA: "A parent container and a command callback",
            optionB: "Only a print statement",
            optionC: "A SQL query",
            optionD: "A class inheritance chain",
            correctOption: "A",
            difficulty: Difficulty.MEDIUM,
          },
          {
            text: "[Demo] Packing widgets with `.pack()` organizes them:",
            optionA: "According to pack geometry rules in the parent",
            optionB: "Randomly on every click",
            optionC: "Only in separate processes",
            optionD: "Without a parent window",
            correctOption: "A",
            difficulty: Difficulty.HARD,
          },
          {
            text: "[Demo] Separating GUI layout code from business logic helps:",
            optionA: "Make the program easier to test and maintain",
            optionB: "Prevent all user input",
            optionC: "Remove event handling",
            optionD: "Disable the main loop",
            correctOption: "A",
            difficulty: Difficulty.HARD,
          },
        ]),
      },
    ],
  },
];
