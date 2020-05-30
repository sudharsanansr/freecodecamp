var printNumTwo;
for (var i = 0; i < 3; i++) {
  if (i === 2) {
    printNumTwo = function() {
      return i;
    };
  }
}
console.log(printNumTwo());
// returns 3

/*
When i == 2, the function is assigned to the printNumTwo variable.
After that the loop execution goes in one more time, which updates the value of i to 3.
Now the function is invoked which returns the value of i, which is 3.
This is due to the concept called closure in JavaScript.
*/