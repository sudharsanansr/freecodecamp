'use strict';

const regexIP = /\b((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/;

function toInt(ip) {

    if (!ip) {
      throw new Error('E_UNDEFINED_IP');
    }
  
    if (!regexIP.test(ip)) {
      throw new Error('E_INVALID_IP');
    }
  
    /*
      String value 189.170.79.173
      Integer	3182055341
  
      To convert an IP address to integer, break it into four octets.
      For example, the ip address you provided can be broken into
  
      First Octet:	189
      Second Octet:	170
      Third Octet:	79
      Fourth Octet:	173
  
      To calculate the decimal address from a dotted string, perform the following calculation.
  
      = (first octet * 256³) + (second octet * 256²) + (third octet * 256) + (fourth octet)
      =	(first octet * 16777216) + (second octet * 65536) + (third octet * 256) + (fourth octet)
      =	(189 * 16777216) + (170 * 65536) + (79 * 256) + (173)
      =	3182055341
  
      Reference http://www.aboutmyip.com/AboutMyXApp/IP2Integer.jsp
    */
  
    return ip.split('.').map((octet, index, array) => {
      return parseInt(octet) * Math.pow(256, (array.length - index - 1));
    }).reduce((prev, curr) => {
      return prev + curr;
    });
  
  }

console.log(toInt("255.255.256.255"));