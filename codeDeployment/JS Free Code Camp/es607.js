//https://www.freecodecamp.org/learn/javascript-algorithms-and-data-structures/es6/write-arrow-functions-with-parameters

const myConcat = (arr1, arr2) => {
    "use strict";
    return arr1.concat(arr2);
  };
  
console.log(myConcat([1, 2], [3, 4, 5]));