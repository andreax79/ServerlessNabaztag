"098f6bcd4621d373cade4e832627b4f6" set-md5-password

: login ( logged line -- logged )
md5 get-md5-password = if "logged" . else "Please login" . then cr
;

: prompt ( -- )
nil "[" :: depth 1 - :: "] > " :: str-join .
;

: interpreter
"
*** ServerlessNabaztag ***
" . revision . "

Welcome to the interactive Forth system.
Type 'words' to see available words.
Type 'quit'  to exit the interpreter.

" .
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
cr "Goodbye." . cr
;
