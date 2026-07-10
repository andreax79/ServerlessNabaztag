\ : load-srv ( filename -- )  \ Load a forth file from the server
\ >r nil server-url @ :: "/" :: r> :: str-join http-get
\ drop \ drop header
\ evaluate ; \ evaluate the content
\
\ "init.forth" load-srv

-1 CONSTANT <TRUE>
0 CONSTANT <FALSE>
0 INVERT CONSTANT MAX-UINT
0 INVERT 1 RSHIFT CONSTANT MAX-INT
0 INVERT 1 RSHIFT INVERT CONSTANT MIN-INT
0 INVERT 1 RSHIFT CONSTANT MID-UINT
0 INVERT 1 RSHIFT INVERT CONSTANT MID-UINT+1


\ F.6.1.0090 * ------------------------------------------------------
T{  0  0 * ->  0 }T
T{  0  1 * ->  0 }T
T{  1  0 * ->  0 }T
T{  1  2 * ->  2 }T
T{  2  1 * ->  2 }T
T{  3  3 * ->  9 }T
T{ -3  3 * -> -9 }T
T{  3 -3 * -> -9 }T
T{ -3 -3 * ->  9 }T


\ F.6.1.0120 + ------------------------------------------------------
T{        0  5 + ->          5 }T
T{        5  0 + ->          5 }T
T{        0 -5 + ->         -5 }T
T{       -5  0 + ->         -5 }T
T{        1  2 + ->          3 }T
T{        1 -2 + ->         -1 }T
T{       -1  2 + ->          1 }T
T{       -1 -2 + ->         -3 }T
T{       -1  1 + ->          0 }T


\ F.6.1.0160 - ------------------------------------------------------
T{          0  5 - ->       -5 }T
T{          5  0 - ->        5 }T
T{          0 -5 - ->        5 }T
T{         -5  0 - ->       -5 }T
T{          1  2 - ->       -1 }T
T{          1 -2 - ->        3 }T
T{         -1  2 - ->       -3 }T
T{         -1 -2 - ->        1 }T
T{          0  1 - ->       -1 }T


\ F.6.1.0250 0< ------------------------------------------------------
T{       0 0< -> <FALSE> }T
T{       0 0< -> <FALSE> }T
T{      -1 0< -> <TRUE>  }T
\ T{ MIN-INT 0< -> <TRUE>  }T
T{       1 0< -> <FALSE> }T
\ T{ MAX-INT 0< -> <FALSE> }T


\ F.6.1.0270 0= -----------------------------------------------------
T{        0 0= -> <TRUE>  }T
T{        1 0= -> <FALSE> }T
T{        2 0= -> <FALSE> }T
T{       -1 0= -> <FALSE> }T
T{ MAX-UINT 0= -> <FALSE> }T
\ T{ MIN-INT  0= -> <FALSE> }T
T{ MAX-INT  0= -> <FALSE> }T


\ F.6.1.0290 1+ ----------------------------------------------------
T{        0 1+ ->          1 }T
T{       -1 1+ ->          0 }T
T{        1 1+ ->          2 }T
T{ MID-UINT 1+ -> MID-UINT+1 }T


\ F.6.1.0300 1- ----------------------------------------------------
T{          2 1- ->        1 }T
T{          1 1- ->        0 }T
T{          0 1- ->       -1 }T
T{ MID-UINT+1 1- -> MID-UINT }T


\ F.6.1.1200 DEPTH --------------------------------------------------
T{ 0 1 DEPTH -> 0 1 2 }T
T{   0 DEPTH -> 0 1   }T
T{     DEPTH -> 0     }T


\ F.6.1.1260 DROP ---------------------------------------------------
T{ 1 2 DROP -> 1 }T
T{ 0   DROP ->   }T


\ F.6.1.1290 DUP ----------------------------------------------------
T{ 1 DUP -> 1 1 }T


\ F.6.1.1700 IF -----------------------------------------------------
T{ : GI1 IF 123 THEN ; -> }T
T{ : GI2 IF 123 ELSE 234 THEN ; -> }T
T{  0 GI1 ->     }T
T{  1 GI1 -> 123 }T
T{ -1 GI1 -> 123 }T
T{  0 GI2 -> 234 }T
T{  1 GI2 -> 123 }T
T{ -1 GI1 -> 123 }T


\ F.6.1.1720 INVERT -------------------------------------------------
T{ 0 INVERT -> -1 }T
T{ -1 INVERT -> 0 }T


\ F.6.1.2160 ROT -----------------------------------------------------
\ T{ 1 2 3 ROT -> 2 3 1 }T


\ F.6.1.2162 RSHIFT -------------------------------------------------
T{    1 0 RSHIFT -> 1 }T
T{    1 1 RSHIFT -> 0 }T
T{    2 1 RSHIFT -> 1 }T
T{    4 2 RSHIFT -> 1 }T


\ F.6.1.2260 SWAP ----------------------------------------------------
T{ 1 2 SWAP -> 2 1 }T


: on-connect ( -- )
reboot
;
