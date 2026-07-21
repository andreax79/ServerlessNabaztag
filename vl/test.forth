\ : load-srv ( filename -- )  \ Load a forth file from the server
\ >r nil server-url @ :: "/" :: r> :: str-join http-get
\ drop \ drop header
\ evaluate ; \ evaluate the content
\
\ "init.forth" load-srv

: 2drop ( x1 x2 -- )
drop drop ;

: 2dup ( x1 x2 -- x1 x2 x1 x2 )
over over ;

: 2over ( x1 x2 x3 x4 -- x1 x2 x3 x4 x1 x2 )
3 pick 3 pick ;

: 2swap ( x1 x2 x3 x4 -- x3 x4 x1 x2 )
rot >r rot r> ;

\ ------------------------------------------------------------------

: 0S   0 ;
: 1S   0 INVERT ;
: MSB  1S 1 RSHIFT INVERT ;


\ F.3.1 Basic Assumptions -------------------------------------------

T{ -> }T
T{ : BITSSET? IF 0 0 ELSE 0 THEN ; -> }T
T{  0 BITSSET? -> 0 }T
T{  1 BITSSET? -> 0 0 }T
T{ -1 BITSSET? -> 0 0 }T


\ F.3.4 Numeric notation --------------------------------------------

T{ #1289       -> 1289        }T
T{ #-1289      -> -1289       }T
T{ $12eF       -> 4847        }T
\ T{ $-12eF      -> -4847       }T
\ T{ %10010110   -> 150         }T
\ T{ %-10010110  -> -150        }T


\ F.3.5 Comparisons -------------------------------------------------
0 INVERT CONSTANT MAX-UINT
0 INVERT 1 RSHIFT CONSTANT MAX-INT
0 INVERT 1 RSHIFT INVERT CONSTANT MIN-INT
0 INVERT 1 RSHIFT CONSTANT MID-UINT
0 INVERT 1 RSHIFT INVERT CONSTANT MID-UINT+1
0S CONSTANT <FALSE>
1S CONSTANT <TRUE>


\ F.6 The Core word set =============================================



\ F.6.1.0070 ' ------------------------------------------------------
T{ : GT1 123 ; -> }T
T{ ' GT1 EXECUTE -> 123 }T


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


\ F.6.1.0150 ,
\ HERE 1 ,
\ HERE 2 ,
\ CONSTANT 2ND
\ CONSTANT 1ST
\ \ F.6.1.0130 +!
\ T{  0 1ST !        ->   }T
\ T{  1 1ST +!       ->   }T
\ T{    1ST @        -> 1 }T
\ T{ -1 1ST +! 1ST @ -> 0 }T


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
T{ MIN-INT 0< -> <TRUE>  }T
T{       1 0< -> <FALSE> }T
T{ MAX-INT 0< -> <FALSE> }T


\ F.6.1.0270 0= -----------------------------------------------------
T{        0 0= -> <TRUE>  }T
T{        1 0= -> <FALSE> }T
T{        2 0= -> <FALSE> }T
T{       -1 0= -> <FALSE> }T
T{ MAX-UINT 0= -> <FALSE> }T
T{ MIN-INT  0= -> <FALSE> }T
T{ MAX-INT  0= -> <FALSE> }T


\ F.6.1.0290 1+ -----------------------------------------------------
T{        0 1+ ->          1 }T
T{       -1 1+ ->          0 }T
T{        1 1+ ->          2 }T
T{ MID-UINT 1+ -> MID-UINT+1 }T


\ F.6.1.0300 1- -----------------------------------------------------
T{          2 1- ->        1 }T
T{          1 1- ->        0 }T
T{          0 1- ->       -1 }T
T{ MID-UINT+1 1- -> MID-UINT }T


\ F.6.1.0320 2* -----------------------------------------------------
T{    0S 2*       ->    0S }T
T{     1 2*       ->     2 }T
T{ $4000 2*       -> $8000 }T
T{    1S 2* 1 XOR ->    1S }T
T{   MSB 2*       ->    0S }T


\ F.6.1.0330 2/ -----------------------------------------------------
T{          0S 2/ ->    0S }T
T{           1 2/ ->     0 }T
T{       $4000 2/ -> $2000 }T
T{          1S 2/ ->    1S }T
T{    1S 1 XOR 2/ ->    1S }T
T{ MSB 2/ MSB AND ->   MSB }T


\ F.6.1.0370 2DROP --------------------------------------------------

T{ 1 2 2DROP -> }T


\ F.6.1.0380 2DUP ---------------------------------------------------
T{ 1 2 2DUP -> 1 2 1 2 }T


\ F.6.1.0400 2OVER --------------------------------------------------
T{ 1 2 3 4 2OVER -> 1 2 3 4 1 2 }T


\ F.6.1.0430 2SWAP --------------------------------------------------
T{ 1 2 3 4 2SWAP -> 3 4 1 2 }T


\ F.6.1.0480 < ------------------------------------------------------
T{       0       1 < -> <TRUE>  }T
T{       1       2 < -> <TRUE>  }T
T{      -1       0 < -> <TRUE>  }T
T{      -1       1 < -> <TRUE>  }T
T{ MIN-INT       0 < -> <TRUE>  }T
T{ MIN-INT MAX-INT < -> <TRUE>  }T
T{       0 MAX-INT < -> <TRUE>  }T
T{       0       0 < -> <FALSE> }T
T{       1       1 < -> <FALSE> }T
T{       1       0 < -> <FALSE> }T
T{       2       1 < -> <FALSE> }T
T{       0      -1 < -> <FALSE> }T
T{       1      -1 < -> <FALSE> }T
T{       0 MIN-INT < -> <FALSE> }T
T{ MAX-INT MIN-INT < -> <FALSE> }T
T{ MAX-INT       0 < -> <FALSE> }T


\ F.6.1.0530 = ------------------------------------------------------
T{  0  0 = -> <TRUE>  }T
T{  1  1 = -> <TRUE>  }T
T{ -1 -1 = -> <TRUE>  }T
T{  1  0 = -> <FALSE> }T
T{ -1  0 = -> <FALSE> }T
T{  0  1 = -> <FALSE> }T
T{  0 -1 = -> <FALSE> }T


\ F.6.1.0540 > ------------------------------------------------------
T{       0       1 > -> <FALSE> }T
T{       1       2 > -> <FALSE> }T
T{      -1       0 > -> <FALSE> }T
T{      -1       1 > -> <FALSE> }T
T{ MIN-INT       0 > -> <FALSE> }T
T{ MIN-INT MAX-INT > -> <FALSE> }T
T{       0 MAX-INT > -> <FALSE> }T
T{       0       0 > -> <FALSE> }T
T{       1       1 > -> <FALSE> }T
T{       1       0 > -> <TRUE>  }T
T{       2       1 > -> <TRUE>  }T
T{       0      -1 > -> <TRUE>  }T
T{       1      -1 > -> <TRUE>  }T
T{       0 MIN-INT > -> <TRUE>  }T
T{ MAX-INT MIN-INT > -> <TRUE>  }T
T{ MAX-INT       0 > -> <TRUE>  }T


\ F.6.1.0580 >R -----------------------------------------------------
T{ : GR1 >R R> ; -> }T
T{ : GR2 >R R@ R> DROP ; -> }T
T{ 123 GR1 -> 123 }T
T{ 123 GR2 -> 123 }T
T{  1S GR1 ->  1S }T


\ F.6.1.0630 ?DUP ---------------------------------------------------
T{ -1 ?DUP -> -1 -1 }T
T{  0 ?DUP ->  0    }T
T{  1 ?DUP ->  1  1 }T


\ F.6.1.0690 ABS ----------------------------------------------------
T{       0 ABS ->          0 }T
T{       1 ABS ->          1 }T
T{      -1 ABS ->          1 }T
T{ MIN-INT ABS -> MID-UINT+1 }T


\ F.6.1.0720 AND ----------------------------------------------------
T{ 0 0 AND -> 0 }T
T{ 0 1 AND -> 0 }T
T{ 1 0 AND -> 0 }T
T{ 1 1 AND -> 1 }T
T{ 0 INVERT 1 AND -> 1 }T
T{ 1 INVERT 1 AND -> 0 }T
T{ 0S 0S AND -> 0S }T
T{ 0S 1S AND -> 0S }T
T{ 1S 0S AND -> 0S }T
T{ 1S 1S AND -> 1S }T


\ F.6.1.0770 BL -----------------------------------------------------
T{ BL -> $20 }T

\ F.6.2.0873 CASE ---------------------------------------------------
: cs1 CASE
   1 OF 111 ENDOF
   2 OF 222 ENDOF
   3 OF 333 ENDOF
   >R 999 R>
   ENDCASE
;

T{ 1 cs1 -> 111 }T
T{ 2 cs1 -> 222 }T
T{ 3 cs1 -> 333 }T
\ T{ 4 cs1 -> 999 }T

\ T{ 4 cs1 -> 999 }T
\ : cs2 >R CASE
\    -1 OF CASE R@ 1 OF 100 ENDOF
\                 2 OF 200 ENDOF
\                 >R -300 R>
\         ENDCASE
\      ENDOF
\    -2 OF CASE R@ 1 OF -99 ENDOF
\                 >R -199 R>
\         ENDCASE
\      ENDOF
\      >R 299 R>
\    ENDCASE R> DROP ;
\
\ T{ -1 1 cs2 ->  100 }T
\ T{ -1 2 cs2 ->  200 }T
\ T{ -1 3 cs2 -> -300 }T
\ T{ -2 1 cs2 ->  -99 }T
\ T{ -2 2 cs2 -> -199 }T
\ T{  0 2 cs2 ->  299 }T


\ F.6.1.0950 CONSTANT -----------------------------------------------
T{ 123 CONSTANT X123 -> }T
T{ X123 -> 123 }T
T{ : EQU CONSTANT ; -> }T
T{ X123 EQU Y123 -> }T
T{ Y123 -> 123 }T


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


\ F.6.1.1710 IMMEDIATE ----------------------------------------------
T{ 123 CONSTANT iw1 IMMEDIATE iw1 -> 123 }T
T{ : iw2 iw1 LITERAL ; iw2 -> 123 }T
T{ VARIABLE iw3 IMMEDIATE 234 iw3 ! iw3 @ -> 234 }T
T{ : iw4 iw3 [ @ ] LITERAL ; iw4 -> 234 }T

VARIABLE IM-FLAG
T{ 0 IM-FLAG ! -> }T
T{ : MARK-IMMEDIATE 77 IM-FLAG ! ; IMMEDIATE -> }T
T{ : USE-MARK MARK-IMMEDIATE ; -> }T
T{ IM-FLAG @ -> 77 }T
T{ 0 IM-FLAG ! MARK-IMMEDIATE IM-FLAG @ -> 77 }T


\ F.6.1.1720 INVERT -------------------------------------------------
T{ 0 INVERT -> -1 }T
T{ -1 INVERT -> 0 }T


\ F.6.1.1805 LSHIFT -------------------------------------------------
T{   1  0 LSHIFT ->     1 }T
T{   1  1 LSHIFT ->     2 }T
T{   1  2 LSHIFT ->     4 }T
T{   1 $F LSHIFT -> $8000 }T
T{  1S  1 LSHIFT 1 XOR -> 1S }T
T{ MSB  1 LSHIFT ->     0 }T


\ F.6.1.1870 MAX ----------------------------------------------------
T{       0       1 MAX ->       1 }T
T{       1       2 MAX ->       2 }T
T{      -1       0 MAX ->       0 }T
T{      -1       1 MAX ->       1 }T
T{ MIN-INT       0 MAX ->       0 }T
T{ MIN-INT MAX-INT MAX -> MAX-INT }T
T{       0 MAX-INT MAX -> MAX-INT }T
T{       0       0 MAX ->       0 }T
T{       1       1 MAX ->       1 }T
T{       1       0 MAX ->       1 }T
T{       2       1 MAX ->       2 }T
T{       0      -1 MAX ->       0 }T
T{       1      -1 MAX ->       1 }T
T{       0 MIN-INT MAX ->       0 }T
T{ MAX-INT MIN-INT MAX -> MAX-INT }T
T{ MAX-INT       0 MAX -> MAX-INT }T


\ F.6.1.1880 MIN ----------------------------------------------------
T{       0       1 MIN ->       0 }T
T{       1       2 MIN ->       1 }T
T{      -1       0 MIN ->      -1 }T
T{      -1       1 MIN ->      -1 }T
T{ MIN-INT       0 MIN -> MIN-INT }T
T{ MIN-INT MAX-INT MIN -> MIN-INT }T
T{       0 MAX-INT MIN ->       0 }T
T{       0       0 MIN ->       0 }T
T{       1       1 MIN ->       1 }T
T{       1       0 MIN ->       0 }T
T{       2       1 MIN ->       1 }T
T{       0      -1 MIN ->      -1 }T
T{       1      -1 MIN ->      -1 }T
T{       0 MIN-INT MIN -> MIN-INT }T
T{ MAX-INT MIN-INT MIN -> MIN-INT }T
T{ MAX-INT       0 MIN ->       0 }T


\ F.6.1.1910 NEGATE -------------------------------------------------
T{  0 NEGATE ->  0 }T
T{  1 NEGATE -> -1 }T
T{ -1 NEGATE ->  1 }T
T{  2 NEGATE -> -2 }T
T{ -2 NEGATE ->  2 }T


\ F.6.1.1980 OR ------------------------------------------------------
T{ 0S 0S OR -> 0S }T
T{ 0S 1S OR -> 1S }T
T{ 1S 0S OR -> 1S }T
T{ 1S 1S OR -> 1S }T


\ F.6.1.1990 OVER ----------------------------------------------------
T{ 1 2 OVER -> 1 2 1 }T


\ F.6.1.2120 RECURSE -------------------------------------------------

T{ : GFACT ( n -- n! ) DUP 2 < IF DROP 1 EXIT THEN DUP 1- RECURSE * ; -> }T
T{ 0 GFACT -> 1 }T
T{ 1 GFACT -> 1 }T
T{ 2 GFACT -> 2 }T
T{ 5 GFACT -> 120 }T

T{ ( A comment ) 1234 -> 1234 }T

\ PICK --------------------------------------------------------------
T{ 123 0         PICK -> 123 123 }T
T{ 10 20 1       PICK -> 10 20 10 }T
T{ 1 2 3 2       PICK -> 1 2 3 1 }T
T{ 1 2 3 4 3     PICK -> 1 2 3 4 1 }T
T{ -1 -2 -3 1    PICK -> -1 -2 -3 -2 }T
T{ 11 22 33 44 2 PICK -> 11 22 33 44 22 }T
T{ 99 0          PICK -> 99 99 }T


\ ROLL --------------------------------------------------------------
T{ 123 0       ROLL -> 123 }T
T{ 10 20 1     ROLL -> 20 10 }T
T{ 1 2 3 2     ROLL -> 2 3 1 }T
T{ 1 2 3 4 3   ROLL -> 2 3 4 1 }T
T{ 1 2 3 4 5 2 ROLL -> 1 2 4 5 3 }T
T{ -1 -2 -3 2  ROLL -> -2 -3 -1 }T
T{ 99 0        ROLL -> 99 }T


\ F.6.1.2160 ROT ----------------------------------------------------
T{ 1 2 3 ROT -> 2 3 1 }T


\ F.6.1.2162 RSHIFT -------------------------------------------------
T{    1 0 RSHIFT -> 1 }T
T{    1 1 RSHIFT -> 0 }T
T{    2 1 RSHIFT -> 1 }T
T{    4 2 RSHIFT -> 1 }T
T{  MSB 1 RSHIFT MSB AND ->   0 }T
T{  MSB 1 RSHIFT     2*  -> MSB }T


\ F.6.1.2260 SWAP ---------------------------------------------------
T{ 1 2 SWAP -> 2 1 }T


\ F.6.1.2410 VARIABLE -----------------------------------------------
T{ VARIABLE V1 ->     }T
T{    123 V1 ! ->     }T
T{        V1 @ -> 123 }T


\ F.6.1.2490 XOR ----------------------------------------------------
T{ 0S 0S XOR -> 0S }T
T{ 0S 1S XOR -> 1S }T
T{ 1S 0S XOR -> 1S }T
T{ 1S 1S XOR -> 0S }T


\ F.6.1.2500 [ ------------------------------------------------------
T{ : GC1 58 ; -> }T
T{ : GC3 [ GC1 ] LITERAL ; -> }T
T{ GC3 -> 58 }T

\ F.6.1.2510 ['] ----------------------------------------------------
T{ : GXT ['] GT1 ; -> }T
T{ GXT EXECUTE -> 123 }T

T{ : GT-LIT [ 3 4 + ] LITERAL ; -> }T
T{ GT-LIT -> 7 }T
T{ : GT-LIT2 1 [ 2 3 + ] LITERAL + ; -> }T
T{ GT-LIT2 -> 6 }T


: on-connect ( -- )
reboot
;
