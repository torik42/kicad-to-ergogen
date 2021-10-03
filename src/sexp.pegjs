{const SExp = require('./sexp').SExp}

sexp
 =  _ "(" _ name:symbol _ contents:( SEXP  _ )* ")" _ {
     return new SExp(name, contents.map(x => x[0]))
 }
 
/* 
sexp
 =  _ "(" _ name:symbol _ contents:( SEXP  _ )* ")" _ {
     return {
         [name]: contents.map(x => x[0])
       }
 }
 */

SEXP =  symbol / string / array / symbol / sexp


// --------------------------------------------------
// strings
// --------------------------------------------------

string = value:_string { return "\"" + value[1].replace(/\$/g, "\\$") + "\"" }



_string
  = ('"' $(DoubleStringCharacter*) '"' )
  / ("'" $(SingleStringCharacter*) "'" )
  
DoubleStringCharacter
  = !('"' / "\\") char:. { return char; }
  / "\\" sequence:EscapeSequence { return sequence; }

SingleStringCharacter
  = !("'" / "\\") char:. { return char; }
  / "\\" sequence:EscapeSequence { return sequence; }

EscapeSequence
  = "'"
  / '"'
  / "\\"
  / "b"  { return "\b";   }
  / "f"  { return "\f";   }
  / "n"  { return "\n";   }
  / "r"  { return "\r";   }
  / "t"  { return "\t";   }
  / "v"  { return "\x0B"; }


// skipping net, pinfunction, die_llength

// --------------------------------------------------
// BASIC TYPES
// --------------------------------------------------

array
    = "[" _ value:(string/symbol/number) _  values:((string/symbol/number) _ "," _ )*"]" {
        return {
            type: "array",
            values: [ value, ...values.map(x => x[0])]
        }
    }


//symbol 
//   = value:$([^0-9 "();'\n\/][^ "();'\n]*) {
//       return {type:"symbol",value}
//   }

symbol 
   = value:$([^ ();"'\n]+) {
       return value.replace(/\$/g, "\\$")
   }

_ "whitespace"
  = [ \t\n\r]*

// <number>::= [<sign>] [<positive_integer> | <real> | <fraction>]
number
    = value:$([-+]?  (Fraction/Real)) {
        return { type:"number", value }
    }

Real
  = value:$((digits("."(digits?))?) / "." digits) {
      return { type:"real", value }

  }
  
Fraction 
  = n:digits "/" d:digits {
      return { type:"fraction", n:n, d:d }
  }

// <positive_integer>::= [<digit> | <digit><positive_integer>]
digits = $([0-9]+)

// <sign>::= [+ | -]
// <real>::= [<positive_integer>. | <positive_integer>.<positive_integer> | <positive_integer>]
// <fraction>::= <positive_integer> / <positive_integer>

hex 
    = value:$([0-9a-fA-F]+) {
        return {"type": "hex", value }
    }
