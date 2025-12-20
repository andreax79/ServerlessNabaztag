: login ( -- )  \ Login
md5-password @ nil = invert if
  cr "Please login" . cr cr
  begin
    "Username: " . read-line username @ =
    "Password: " . read-line md5 md5-password @ =
    and
    dup invert if "Invalid login" . cr cr then
  until
then ;

: prompt ( -- )  \ Display the Forth interpreter prompt
nil "[" :: depth 1 - :: "] > " :: str-join . ;

: help ( -- )
"
Type 'words' to see available words.
Type 'quit'  to exit the interpreter.

" . ;

: interpreter ( -- )  \ Interactive Forth interpreter
"
*** ServerlessNabaztag ***
" . revision . "
" .
login
"
Welcome to the interactive Forth system.
" .
help
begin
  prompt read-line  \ display the prompt and read a line
  dup "quit" = if   \ check if the line is 'quit'
    drop            \ drop the line
    1               \ exit
  else
    evaluate        \ evalute the line
    0               \ continue
  then
until
cr "Goodbye." . cr ;
