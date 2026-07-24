: 2drop ( x1 x2 -- )  \ Drop the top two cells from the stack
drop drop ;

: 2dup ( x1 x2 -- x1 x2 x1 x2 )  \ Copy the top two cells on the stack
over over ;

: 2over ( x1 x2 x3 x4 -- x1 x2 x3 x4 x1 x2 )  \ Copy the second pair of cells to the top of the stack
3 pick 3 pick ;

: 2swap ( x1 x2 x3 x4 -- x3 x4 x1 x2 )  \ Exchange the top two cell pairs
rot >r rot r> ;

: cell+ ( addr1 -- addr2 )  \ Add one cell to an address
1 + ;

: cells ( n -- n )  \ Multiply n by the size of a cell
;

: 2@ ( addr -- x1 x2 )  \ Fetch two cells from memory
dup cell+ @ swap @ ;

: 2! ( x1 x2 addr -- )  \ Store two cells into memory
swap over ! cell+ ! ;

: between ( n low high -- flag )
>r over r> <= >r >= r> and ;
