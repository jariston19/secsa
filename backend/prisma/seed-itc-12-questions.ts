import { BloomLevel } from "@prisma/client";
import { demoTopic, q, type DemoTopic, type DomainQuestionSet } from "./seed-itc-programming.js";

const d = (sets: DomainQuestionSet) => sets;

export const ITC_12_TOPICS: DemoTopic[] = [
  demoTopic(
    "Variables",
    d({
      [BloomLevel.KNOWLEDGE]: [
        q(
          "Which C++ statement correctly declares an integer variable named count?",
          "integer count;",
          "int count;",
          "var count = int;",
          "count: int;",
          "B"
        ),
        q(
          "Which declares a double variable named rate?",
          "double rate;",
          "decimal rate;",
          "rate: double =;",
          "var double rate;",
          "A"
        ),
        q(
          "Which declares a bool variable named done?",
          "bool done;",
          "boolean done;",
          "bit done;",
          "done: true bool;",
          "A"
        ),
      ],
      [BloomLevel.COMPREHENSION]: [
        q(
          "Which operator assigns a value to a variable in C++?",
          "==",
          "=",
          ":=",
          "->",
          "B"
        ),
        q(
          "What is the difference between `=` and `==` in C++?",
          "Both compare values",
          "= assigns; == compares equality",
          "== assigns; = compares",
          "They are interchangeable",
          "B"
        ),
        q(
          "Why should variable names be meaningful?",
          "They make code compile faster",
          "They help readers understand purpose",
          "They replace comments entirely",
          "They prevent syntax errors",
          "B"
        ),
      ],
      [BloomLevel.APPLICATION]: [
        q(
          "After `int x = 5; x += 3;`, what is the value of x?",
          "3",
          "5",
          "8",
          "53",
          "C"
        ),
        q(
          "Which C++ type is best for storing a single character?",
          "string",
          "char",
          "bool",
          "double",
          "B"
        ),
        q(
          "After `int a = 4, b = 9;`, which swap leaves a=9 and b=4?",
          "a = b; b = a;",
          "int temp = a; a = b; b = temp;",
          "a + b; b - a;",
          "swap a b;",
          "B"
        ),
      ],
      [BloomLevel.ANALYSIS]: [
        q(
          "A variable declared inside a function block is visible:",
          "Throughout the entire program",
          "Only inside that block",
          "Only in main()",
          "In every function in the file",
          "B"
        ),
        q(
          "Which statement best compares local and global variables?",
          "Locals persist after the program ends",
          "Globals are limited to one block",
          "Locals are scoped to their block; globals are file-wide",
          "There is no difference",
          "C"
        ),
        q(
          "Given `int n = 2;` then `n = n * 3;`, what changed?",
          "The variable name",
          "The stored value of n",
          "The data type of n",
          "The scope of n",
          "B"
        ),
      ],
      [BloomLevel.SYNTHESIS]: [
        q(
          "Why use `const int MAX = 100;` instead of a plain int?",
          "const makes the variable global",
          "const prevents reassignment after initialization",
          "const converts the value to a string",
          "const is required for all integers",
          "B"
        ),
        q(
          "Which declaration best stores a student's whole-number age?",
          "string age;",
          "int age;",
          "char age;",
          "void age;",
          "B"
        ),
        q(
          "To track whether input is valid, which design fits best?",
          "int valid = 99;",
          "bool isValid = false;",
          "double isValid;",
          "char valid[];",
          "B"
        ),
      ],
      [BloomLevel.EVALUATION]: [
        q(
          "Which practice is better for readability?",
          "int x = 10;",
          "int studentCount = 10;",
          "int a10 = 10;",
          "int _ = 10;",
          "B"
        ),
        q(
          "Which use of a magic number is weakest style?",
          "const int PASS = 75; if (score >= PASS)",
          "if (score >= 75)",
          "const int PASS = 75;",
          "int threshold = PASS;",
          "B"
        ),
        q(
          "Which global variable design is most problematic?",
          "A named constant used by one helper",
          "A counter changed by many unrelated functions",
          "A flag set once in main",
          "A const used for array size",
          "B"
        ),
      ],
    })
  ),
  demoTopic(
    "Conditions",
    d({
      [BloomLevel.KNOWLEDGE]: [
        q(
          "Which C++ keyword starts a conditional branch?",
          "loop",
          "if",
          "switch",
          "case",
          "B"
        ),
        q(
          "Which keyword selects among many constant cases?",
          "if",
          "switch",
          "while",
          "for",
          "B"
        ),
        q(
          "Which symbol ends a simple if statement in C++?",
          "colon only",
          "semicolon after the body",
          "period",
          "hash",
          "B"
        ),
      ],
      [BloomLevel.COMPREHENSION]: [
        q(
          "Which expression evaluates to true when a equals b in C++?",
          "a = b",
          "a == b",
          "a === b",
          "a := b",
          "B"
        ),
        q(
          "What does `else if` allow in a decision structure?",
          "Only one branch total",
          "Testing additional conditions after the first if",
          "Repeating code forever",
          "Declaring variables",
          "B"
        ),
        q(
          "When is a switch statement preferable to a long if-else chain?",
          "When comparing one variable to many constant values",
          "When no conditions exist",
          "When loops are required",
          "When variables cannot be compared",
          "A"
        ),
      ],
      [BloomLevel.APPLICATION]: [
        q(
          "In C++, which operator combines conditions so both must be true?",
          "||",
          "&&",
          "!",
          "|",
          "B"
        ),
        q(
          "Which condition checks that score is between 60 and 100 inclusive?",
          "score > 60 && score < 100",
          "score >= 60 && score <= 100",
          "score = 60 || score = 100",
          "score >= 60 || score <= 100",
          "B"
        ),
        q(
          "Which if-statement prints \"Pass\" when grade is exactly 75?",
          "if (grade = 75)",
          "if (grade == 75)",
          "if (grade != 75)",
          "if (grade > 75)",
          "B"
        ),
      ],
      [BloomLevel.ANALYSIS]: [
        q(
          "Given `int score = 75;`, which condition correctly checks for a passing score of at least 60?",
          "if (score > 60)",
          "if (score >= 60)",
          "if (score = 60)",
          "if (score == 60)",
          "B"
        ),
        q(
          "Why can `if (x = 5)` be dangerous compared to `if (x == 5)`?",
          "It assigns instead of comparing",
          "It always crashes",
          "It declares a new variable",
          "It cannot compile",
          "A"
        ),
        q(
          "Which trace matches `int a=3; if (a>2) a++; else a--;`?",
          "a becomes 2",
          "a becomes 4",
          "a stays 3",
          "a becomes 0",
          "B"
        ),
      ],
      [BloomLevel.SYNTHESIS]: [
        q(
          "A nested if inside another if is most useful when:",
          "You need unrelated loops",
          "A second decision depends on the first being true",
          "You want to skip semicolons",
          "Variables must be global",
          "B"
        ),
        q(
          "Which structure best validates input then prints a grade band?",
          "One if with no else",
          "Nested if/else after checking input is valid",
          "A while loop only",
          "A switch with no cases",
          "B"
        ),
        q(
          "To classify 90+ as A and 80+ as B, which design is clearest?",
          "Independent ifs without order",
          "Ordered if/else if chain from highest threshold",
          "switch on floating score",
          "goto labels",
          "B"
        ),
      ],
      [BloomLevel.EVALUATION]: [
        q(
          "Which condition style is easiest to maintain?",
          "Deeply nested ifs five levels deep",
          "Flat else-if ladder with named thresholds",
          "Duplicate copies of the same test",
          "Mixed assignment and comparison",
          "B"
        ),
        q(
          "Which boolean expression is logically equivalent to `!(a && b)`?",
          "!a || !b",
          "!a && !b",
          "a || b",
          "a && b",
          "A"
        ),
        q(
          "Which decision code best avoids unreachable branches?",
          "else if after a final else",
          "Ordered checks from most specific to general",
          "Two separate main functions",
          "switch without default when required",
          "B"
        ),
      ],
    })
  ),
  demoTopic(
    "Loops",
    d({
      [BloomLevel.KNOWLEDGE]: [
        q(
          "Which C++ loop repeats while a condition is true and checks the condition first?",
          "for",
          "while",
          "do-while",
          "foreach",
          "B"
        ),
        q(
          "Which loop always runs its body at least once?",
          "while",
          "for",
          "do-while",
          "if",
          "C"
        ),
        q(
          "Which keyword skips the rest of the current loop iteration?",
          "stop",
          "continue",
          "exit",
          "return main",
          "B"
        ),
      ],
      [BloomLevel.COMPREHENSION]: [
        q(
          "In `for (int i = 0; i < 5; i++)`, how many times does the body run?",
          "4",
          "5",
          "6",
          "0",
          "B"
        ),
        q(
          "What does `i++` do inside a for loop?",
          "Decreases i by 1",
          "Increases i by 1",
          "Multiplies i by 2",
          "Resets i to 0",
          "B"
        ),
        q(
          "A do-while loop differs from while because:",
          "It never runs the body",
          "It runs the body at least once",
          "It requires three expressions",
          "It cannot use a counter",
          "B"
        ),
      ],
      [BloomLevel.APPLICATION]: [
        q(
          "Which loop header prints values 1 through 10 inclusive?",
          "for (int i = 1; i < 10; i++)",
          "for (int i = 1; i <= 10; i++)",
          "for (int i = 0; i > 10; i++)",
          "for (int i = 10; i < 1; i++)",
          "B"
        ),
        q(
          "Which loop best sums array elements when size is known?",
          "for with index from 0 to size-1",
          "if/else chain",
          "switch on each element",
          "single assignment",
          "A"
        ),
        q(
          "To read until sentinel -1, which pattern fits?",
          "for (int i=0;i<10;i++) only",
          "while (input != -1)",
          "do {} while(false);",
          "switch(-1)",
          "B"
        ),
      ],
      [BloomLevel.ANALYSIS]: [
        q(
          "An infinite loop is most likely caused by:",
          "Updating the loop variable inside the body",
          "Never changing the condition toward false",
          "Using int instead of double",
          "Including iostream",
          "B"
        ),
        q(
          "Why is `for (int i = 0; i <= 5; i++)` over a size-5 array risky?",
          "It uses too little memory",
          "Index 5 is out of bounds when valid indices are 0-4",
          "It cannot print values",
          "It skips index 0",
          "B"
        ),
        q(
          "Which change fixes `while (true)` that should stop at 10 iterations?",
          "Remove the loop body",
          "Add a counter and break at 10",
          "Use char instead of int",
          "Delete semicolons",
          "B"
        ),
      ],
      [BloomLevel.SYNTHESIS]: [
        q(
          "Which nested loop structure prints a multiplication table?",
          "One while with no inner loop",
          "Outer loop for rows and inner loop for columns",
          "switch inside if only",
          "Single for with no body",
          "B"
        ),
        q(
          "To find the first negative value in an array, which design fits?",
          "Loop until found, then break",
          "Always scan entire array twice",
          "Use only do-while without test",
          "Avoid loops entirely",
          "A"
        ),
        q(
          "Which pattern validates input until within 1-5?",
          "Read once and assume valid",
          "Loop until value is between 1 and 5",
          "Use goto on error",
          "Print error without retry",
          "B"
        ),
      ],
      [BloomLevel.EVALUATION]: [
        q(
          "Which loop choice is best for unknown repetitions until a sentinel?",
          "for with fixed 100 iterations",
          "while reading until sentinel",
          "do-while with empty body only",
          "switch on counter",
          "B"
        ),
        q(
          "Which refactor improves clarity?",
          "Replace `for(;;)` with `while(true)` and documented break",
          "Hide break inside nested ifs without comment",
          "Duplicate loop bodies",
          "Use magic numbers for bounds",
          "A"
        ),
        q(
          "Which loop is weakest for processing exactly n items in an array?",
          "for (int i=0;i<n;i++)",
          "while(i<n)",
          "if/else per element without iteration",
          "do-while with index",
          "C"
        ),
      ],
    })
  ),
  demoTopic(
    "Arrays",
    d({
      [BloomLevel.KNOWLEDGE]: [
        q(
          "Which declares an integer array of size 5 in C++?",
          "int arr(5);",
          "int arr[5];",
          "array int[5] arr;",
          "int[] arr = 5;",
          "B"
        ),
        q(
          "What is the index of the first element in a C++ array?",
          "1",
          "0",
          "-1",
          "Depends on size",
          "B"
        ),
        q(
          "Which initializes `int vals[3] = {1,2,3};` correctly?",
          "Yes, braces list three values",
          "No, arrays cannot initialize",
          "Only strings may use braces",
          "Size must be omitted always",
          "A"
        ),
      ],
      [BloomLevel.COMPREHENSION]: [
        q(
          "If `int nums[4] = {10, 20, 30, 40};`, what is nums[2]?",
          "20",
          "30",
          "40",
          "2",
          "B"
        ),
        q(
          "Why are array indices zero-based in C++?",
          "Language convention for offset from start address",
          "To match human counting only",
          "Because arrays cannot hold more than one item",
          "To prevent loops",
          "A"
        ),
        q(
          "What does array length 5 mean for valid indices?",
          "Indices 1 through 5",
          "Indices 0 through 4",
          "Indices 0 through 5",
          "Any integer index",
          "B"
        ),
      ],
      [BloomLevel.APPLICATION]: [
        q(
          "Accessing `arr[10]` when the array size is 5 causes:",
          "Automatic resizing",
          "Undefined behavior / out-of-bounds access",
          "A compile-time error always",
          "The value 0 always",
          "B"
        ),
        q(
          "Which loop safely visits every element of `int data[5]`?",
          "for (int i = 1; i <= 5; i++)",
          "for (int i = 0; i < 5; i++)",
          "for (int i = 0; i <= 5; i++)",
          "for (int i = 5; i > 0; i--)",
          "B"
        ),
        q(
          "To store total of `int scores[4]`, which approach works?",
          "Sum with loop over indices 0..3",
          "Multiply indices only",
          "Use scores[4] always",
          "Ignore array size",
          "A"
        ),
      ],
      [BloomLevel.ANALYSIS]: [
        q(
          "Iterating through every element of `int data[5]` safely requires indices:",
          "1 through 5",
          "0 through 4",
          "0 through 5",
          "5 through 0 only",
          "B"
        ),
        q(
          "Which bug is present in `for (int i=0; i<=5; i++) cout << arr[i];` for size 5?",
          "Uses too few iterations",
          "Accesses arr[5], which is out of bounds",
          "Cannot compile",
          "Skips arr[0]",
          "B"
        ),
        q(
          "Compare fixed array vs vector when size is unknown at compile time:",
          "Fixed array always grows automatically",
          "vector can resize; fixed array size is set at declaration",
          "Both resize freely",
          "Neither stores multiple values",
          "B"
        ),
      ],
      [BloomLevel.SYNTHESIS]: [
        q(
          "To store a list of student scores that may grow, which is more flexible than a fixed array?",
          "A single char variable",
          "std::vector",
          "A bool flag",
          "A macro",
          "B"
        ),
        q(
          "Which design finds the maximum value in `int a[n]`?",
          "Assume a[0] is max, loop and update if larger found",
          "Always return a[n-1]",
          "Sort descending only",
          "Use only a[0]",
          "A"
        ),
        q(
          "Which plan copies array A into array B of same size?",
          "Loop assign B[i] = A[i] for each index",
          "Assign B = A pointer only without elements",
          "Copy only first element",
          "Use unrelated variable",
          "A"
        ),
      ],
      [BloomLevel.EVALUATION]: [
        q(
          "Which storage choice is better for unknown number of quiz scores?",
          "int scores[3]; only",
          "std::vector<int> scores;",
          "Single int score;",
          "bool scores[100];",
          "B"
        ),
        q(
          "Which code best prevents off-by-one errors?",
          "Use array size constant and loop while i < SIZE",
          "Hard-code index 5 for size-5 array",
          "Never use loops",
          "Compare indices to size with <=",
          "A"
        ),
        q(
          "Which approach is weakest for searching an unsorted array?",
          "Linear scan until found",
          "Binary search without sorting",
          "Check each element once",
          "Return not found after full scan",
          "B"
        ),
      ],
    })
  ),
  demoTopic(
    "Functions",
    d({
      [BloomLevel.KNOWLEDGE]: [
        q(
          "Which keyword specifies the return type of a C++ function?",
          "return type appears before the function name",
          "function keyword only",
          "def",
          "proc",
          "A"
        ),
        q(
          "What does `return 0;` typically mean in main()?",
          "Program failed",
          "Successful program termination",
          "Skip all loops",
          "Print zero only",
          "B"
        ),
        q(
          "Which symbol separates parameters in a function parameter list?",
          "semicolon",
          "comma",
          "colon",
          "hash",
          "B"
        ),
      ],
      [BloomLevel.COMPREHENSION]: [
        q(
          "A function parameter is:",
          "A value the function returns",
          "An input variable listed in the function definition",
          "A global constant",
          "A header file",
          "B"
        ),
        q(
          "What does the return type `void` indicate?",
          "Returns zero always",
          "Returns no value",
          "Returns a string",
          "Cannot take parameters",
          "B"
        ),
        q(
          "Why declare a function prototype before main?",
          "To let the compiler know signature before use",
          "To remove parameters",
          "To make it global only",
          "To disable return values",
          "A"
        ),
      ],
      [BloomLevel.APPLICATION]: [
        q(
          "Which function signature returns nothing?",
          "int add(int a, int b)",
          "void greet(string name)",
          "double average(int x, int y)",
          "char grade(int score)",
          "B"
        ),
        q(
          "If `int square(int x) { return x*x; }`, what is square(4)?",
          "8",
          "16",
          "4",
          "2",
          "B"
        ),
        q(
          "Which call matches `double avg(int a, int b)`?",
          "avg(\"hi\", 2);",
          "avg(10, 20);",
          "avg();",
          "avg(1,2,3);",
          "B"
        ),
      ],
      [BloomLevel.ANALYSIS]: [
        q(
          "Pass-by-value means the function receives:",
          "A copy of the argument",
          "The memory address only",
          "A reference alias always",
          "No data",
          "A"
        ),
        q(
          "Why might changes to a pass-by-value parameter not affect the caller's variable?",
          "The function modifies a copy",
          "Return is disabled",
          "Parameters are global",
          "Types must match void",
          "A"
        ),
        q(
          "Which trace matches `int f(int x){ return x+1; }` called with 3?",
          "Returns 2",
          "Returns 4",
          "Returns 3",
          "Never returns",
          "B"
        ),
      ],
      [BloomLevel.SYNTHESIS]: [
        q(
          "A helper function that computes factorial is best designed to:",
          "Use global variables only",
          "Take input, compute, and return a result",
          "Never use return",
          "Print instead of returning for all callers",
          "B"
        ),
        q(
          "Which design separates input, calculation, and output?",
          "readValues(), computeResult(), printResult()",
          "One giant main only",
          "Global variables for everything",
          "Duplicate code in three files",
          "A"
        ),
        q(
          "To reuse grading logic in two programs, what helps most?",
          "Copy-paste the code block",
          "Put logic in a shared function",
          "Use only inline assembly",
          "Avoid functions",
          "B"
        ),
      ],
      [BloomLevel.EVALUATION]: [
        q(
          "Which function interface is clearest?",
          "int calc(int a,int b,int c,int d,int e);",
          "double computeAverage(const vector<int>& scores);",
          "void doStuff();",
          "int f(); with hidden globals",
          "B"
        ),
        q(
          "Which design violates single-responsibility most?",
          "Function that reads file and renders GUI",
          "Function that adds two integers",
          "Function that returns max of two values",
          "Function that validates one field",
          "A"
        ),
        q(
          "Which return strategy is best for reusable math helpers?",
          "Return computed value to caller",
          "Print result only inside function",
          "Modify unrelated global",
          "Never return; always exit program",
          "A"
        ),
      ],
    })
  ),
  demoTopic(
    "OOP",
    d({
      [BloomLevel.KNOWLEDGE]: [
        q(
          "In C++, a class groups:",
          "Only global variables",
          "Data members and member functions",
          "Preprocessor directives only",
          "Comments only",
          "B"
        ),
        q(
          "An object is:",
          "A blueprint for a class",
          "An instance of a class",
          "A header guard",
          "A loop counter",
          "B"
        ),
        q(
          "Which keyword defines a class type?",
          "object",
          "class",
          "struct only in C",
          "module",
          "B"
        ),
      ],
      [BloomLevel.COMPREHENSION]: [
        q(
          "Which access specifier hides members from outside the class by default in a struct?",
          "private in struct",
          "public in struct",
          "protected only",
          "static only",
          "B"
        ),
        q(
          "A constructor in C++ is called when:",
          "The program exits",
          "An object is created",
          "A file is included",
          "main returns",
          "B"
        ),
        q(
          "What is inheritance used for?",
          "Deleting objects",
          "Creating specialized classes from a base class",
          "Removing methods",
          "Disabling encapsulation",
          "B"
        ),
      ],
      [BloomLevel.APPLICATION]: [
        q(
          "Encapsulation means:",
          "Hiding implementation details behind a class interface",
          "Using only global functions",
          "Removing all private members",
          "Avoiding objects",
          "A"
        ),
        q(
          "If class `Student` has private `int id` and public `getId()`, this design:",
          "Breaks encapsulation",
          "Controls access to id through a method",
          "Makes id global",
          "Prevents object creation",
          "B"
        ),
        q(
          "Which call creates an object of class `Book`?",
          "Book b;",
          "class Book;",
          "object Book;",
          "new Book without type",
          "A"
        ),
      ],
      [BloomLevel.ANALYSIS]: [
        q(
          "Why make data members private?",
          "To prevent any access",
          "To control how data is read or changed",
          "To remove methods",
          "To disable constructors",
          "B"
        ),
        q(
          "How does a derived class relate to a base class?",
          "It inherits attributes and behaviors",
          "It cannot use base members",
          "It replaces the compiler",
          "It removes polymorphism",
          "A"
        ),
        q(
          "Which design exposes too much internal detail?",
          "Public data fields with no validation",
          "Private fields with getters/setters",
          "Methods that enforce rules",
          "Constructors initializing state",
          "A"
        ),
      ],
      [BloomLevel.SYNTHESIS]: [
        q(
          "Which class design models a bank account best?",
          "Public double balance; with no methods",
          "Private balance with deposit/withdraw methods",
          "Global variable balance",
          "Struct with no members",
          "B"
        ),
        q(
          "To model `Dog` extending `Animal`, which feature helps?",
          "Override speak() in Dog",
          "Remove Animal entirely",
          "Make speak private in Animal only",
          "Disable virtual methods always",
          "A"
        ),
        q(
          "Which UML-like plan fits a `Rectangle` class?",
          "Private width/height, public area method",
          "Only global width",
          "No fields, only main",
          "Public mutable everything",
          "A"
        ),
      ],
      [BloomLevel.EVALUATION]: [
        q(
          "Which OOP design is most maintainable?",
          "Small classes with clear responsibilities",
          "One class with all program logic",
          "Only static globals",
          "Public fields everywhere",
          "A"
        ),
        q(
          "Which violates encapsulation most?",
          "Friend function carefully scoped",
          "Public int salary with no checks",
          "Private field with setter validation",
          "Constructor setting defaults",
          "B"
        ),
        q(
          "When is inheritance a poor choice?",
          "When a has-a relationship should use composition instead",
          "When specialized types share behavior",
          "When overriding methods is needed",
          "When base class defines interface",
          "A"
        ),
      ],
    })
  ),
  demoTopic(
    "Algorithm",
    d({
      [BloomLevel.KNOWLEDGE]: [
        q(
          "An algorithm is best defined as:",
          "A programming language",
          "A step-by-step procedure to solve a problem",
          "A computer brand",
          "A syntax error",
          "B"
        ),
        q(
          "Pseudocode is used to:",
          "Compile C++ directly",
          "Describe logic in plain structured steps",
          "Replace all testing",
          "Store binary files",
          "B"
        ),
        q(
          "Which term means the amount of time an algorithm needs relative to input size?",
          "Syntax",
          "Time complexity",
          "Comment block",
          "Header guard",
          "B"
        ),
      ],
      [BloomLevel.COMPREHENSION]: [
        q(
          "Linear search checks elements:",
          "In random order only",
          "One by one until found or end",
          "Only the middle element",
          "Never compares values",
          "B"
        ),
        q(
          "What does O(n) suggest about growth?",
          "Runtime grows linearly with input size",
          "Runtime is always constant",
          "Memory cannot change",
          "Input size is fixed at 1",
          "A"
        ),
        q(
          "Why write pseudocode before coding?",
          "To plan logic without syntax details",
          "To skip testing",
          "To replace the compiler",
          "To delete variables",
          "A"
        ),
      ],
      [BloomLevel.APPLICATION]: [
        q(
          "To find the largest of three numbers, the first step is usually:",
          "Print hello world",
          "Read or receive the three values",
          "Delete the array",
          "Close the program",
          "B"
        ),
        q(
          "Bubble sort repeatedly:",
          "Deletes the smallest item",
          "Swaps adjacent out-of-order elements",
          "Uses recursion only",
          "Sorts without comparisons",
          "B"
        ),
        q(
          "Which algorithm finds a target in an unsorted list?",
          "Binary search immediately",
          "Linear search",
          "Hash without data",
          "Sort then forget target",
          "B"
        ),
      ],
      [BloomLevel.ANALYSIS]: [
        q(
          "An algorithm with O(n) time complexity means runtime grows:",
          "Linearly with input size",
          "Not at all with input size",
          "Exponentially always",
          "Only with compiler version",
          "A"
        ),
        q(
          "Why is binary search faster than linear search on sorted data?",
          "It eliminates half the remaining items each step",
          "It never compares values",
          "It requires unsorted data",
          "It uses more memory always",
          "A"
        ),
        q(
          "Which step analysis fits finding max in unsorted array?",
          "Must inspect each element at least once",
          "Can skip half the elements always",
          "Needs no comparisons",
          "Requires sorted input",
          "A"
        ),
      ],
      [BloomLevel.SYNTHESIS]: [
        q(
          "Which plan sorts five exam scores ascending with a simple method?",
          "Repeatedly compare/swaps passes (bubble sort idea)",
          "Pick random order",
          "Print unsorted only",
          "Use one comparison total",
          "A"
        ),
        q(
          "To search a phone book alphabetically, which approach fits?",
          "Open to middle and narrow range",
          "Check every name from start always",
          "Ignore ordering",
          "Delete entries while searching",
          "A"
        ),
        q(
          "Which algorithm design counts passing scores above 75?",
          "Initialize count=0; loop; increment when score>=75",
          "Return zero without reading data",
          "Sort then discard data",
          "Use undefined variables",
          "A"
        ),
      ],
      [BloomLevel.EVALUATION]: [
        q(
          "Which algorithm choice is better for large sorted datasets?",
          "Binary search",
          "Linear search from index 0 always",
          "Random probe only",
          "Never search",
          "A"
        ),
        q(
          "Which complexity statement is most accurate for nested loops over n items?",
          "Often O(n^2) when both loops run n times",
          "Always O(1)",
          "Always O(log n)",
          "Independent of n",
          "A"
        ),
        q(
          "Which pseudocode quality is strongest?",
          "Clear steps with defined input/output",
          "Vague phrases with no order",
          "Only variable names",
          "Binary machine code",
          "A"
        ),
      ],
    })
  ),
];
