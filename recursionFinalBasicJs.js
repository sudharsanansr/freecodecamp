function rangeOfNumbers(startNum, endNum) {
    if(endNum - startNum < 0){
      return [];
    }
    else{
      var arr = rangeOfNumbers(startNum, endNum - 1);
      arr.push(endNum)
      return arr;
    }
};

console.log(rangeOfNumbers(1,5));
console.log(rangeOfNumbers(6,9));
console.log(rangeOfNumbers(4,4));