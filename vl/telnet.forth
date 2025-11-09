: login ( logged line -- logged )
md5 md5-password = if "logged" . else "Please login" . then cr ;

: prompt ( -- )
\ forth interpreter prompt
nil "[" :: depth 1 - :: "] > " :: str-join . ;

: help ( -- )
"
Type 'words' to see available words.
Type 'quit'  to exit the interpreter.

" . ;

: interpreter ( -- )
\ interactive forth interpreter
"
*** ServerlessNabaztag ***
" . revision . "

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
