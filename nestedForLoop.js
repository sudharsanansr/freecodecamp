function multiplyAll(arr) {
    var product = 1;
    // Only change code below this line
    var sum = 1;
    for(var i = 0; i < arr.length; i++) {
        var loopSum = 1;
        for(var j = 0; j < arr[i].length; j++){
            loopSum *= arr[i][j]; 
        }
        sum *= loopSum;
    }
    // Only change code above this line
    return product * sum;
}

console.log(multiplyAll([[1,2],[3,4],[5,6,7]]));