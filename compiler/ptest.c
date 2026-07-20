// gcc ptest.c -o ptest && ./ptest

#include <stdio.h>

#define TYPE_BINARY 0	// type binaire pour allocation
#define TYPE_TAB 1	// type table pour allocation

#define PNTTOVAL(p) (1+((p)<<1))	// conversion pointeur vers mot mv
#define INTTOVAL(i) ((i)<<1)	// conversion entier vers mot mv

#define VALTOPNT(v) ((v)>>1)	// conversion mot mv vers pointeur
#define VALTOINT(v) ((v)>>1)	// conversion mot mv vers entier

#define NIL (-1)	// nil
#define ISVALPNT(v) ((v)&1)	// teste si un mot mv est un pointeur

#define HEADER_LENGTH 3
#define HEADER_SIZETYPE 0	// la taille contient le header
#define HEADER_GC 1	// bit 0 : marquage, autres bits : adresse après GC
#define HEADER_LIST 2	// pile GC


void print_bits(char *label, int n) {
    printf("%10s = %-10d  ", label, n);
    for (int i = sizeof(n) * 8 - 1; i >= 0; i--)
        printf("%d", (n >> i) & 1);
    printf("\n");
}

int main() {
    int _0s = INTTOVAL(0);
    int _1s = INTTOVAL(-1);

    print_bits("0s", _0s);
    print_bits("1s", _1s);

    int x= -1 >> 1;
    print_bits("x", x);

    // printf("c = %d\n", c);
    // print_bits(c);

    return 0;
}
