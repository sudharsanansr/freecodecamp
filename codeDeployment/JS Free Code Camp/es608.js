//https://www.freecodecamp.org/learn/javascript-algorithms-and-data-structures/es6/set-default-parameters-for-your-functions

const increment = (number, value = 1) => number + value;
//default parameters in arrow function;
//skipped function body "{}" as we have only the return value.
console.log(increment(5,2));
console.log(increment(5));