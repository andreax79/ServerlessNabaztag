//-------------------
// MV
// version WIN32 et POCKETPC
// Sylvain Huet
// Premiere version : 07/01/2003
// Derniere mise a jour : 07/01/2003
//

#ifndef _MEMORY_
#define _MEMORY_

// commenter pour utiliser les fonctions d'allocatio mémoire du C++
//#define _MY_MALLOC_

class Terminal;
class Memory;
class FileSystem;
class Prodbuffer;

#define HEADER_LENGTH 3
#define HEADER_SIZETYPE 0	// la taille contient le header


#define HEADER_TYPE(p) ((p)[HEADER_SIZETYPE]&3)
#define HEADER_SIZE(p) ((p)[HEADER_SIZETYPE]>>2)
#define HEADERSETSIZETYPE(p,size,type) ((p)[HEADER_SIZETYPE]=(size<<2)+(type&3))



#define STACK_FIRST_SIZE 128
class Memory;
class FileSystem;
class Util;
class Winutil;

class Stack
{
private:
public:
	Stack();
	~Stack();
	int size;	// taille du bloc alloué
	int* base;	// début de la pile
	int* pp;	// pointeur de pile
	
	void initialize(int s);
	int bigger(Memory* m);
	void dump(FILE* f);
};

typedef void (*FORGET)(Memory*, void*);


class Memory
{
private:

	// gestion du GC
	int root;	// bloc racine (initialisé avec le premier bloc alloué)

	int size0;

public:
	int gcincperiod;
	int abort;
	// stack courante
	Stack stack;
	Terminal* term;
	FileSystem* filesystem;
	Util *util;
	Winutil *winutil;
	Memory(int size,Terminal *t,FileSystem *fs,bool quiet);
	~Memory();

	int start();
	void stop();

	int addroot(int* p);
	void removeroot(int *p);

	int* malloc(int size,int type);	// allocation (type vaut TYPE_BINARY ou TYPE_TAB)
	int* mallocClear(int size);	// allocation de type TYPE_TAB avec initialisation à NIL
	int* mallocExternal(void* pnt,FORGET fun);	// allocation de type TYPE_EXT (la fonction fun(pnt) sera appelée lors de l'oubli du bloc)
	int pushmalloc(int size,int type);	// allocation (type vaut TYPE_BINARY ou TYPE_TAB)
	int pushmallocClear(int size);	// allocation de type TYPE_TAB avec initialisation à NIL
	int pushExternal(void* pnt,FORGET fun);

	int push(int val);
	void tabset(int* p,int i,int val);
	void stackset(int* p,int val);


	int* storestring(char* src);
	int* storebinary(char* src,int size);
	int* storenosrc(int size);
	int pushstring(char* src);
	int pushbinary(char* src,int size);
	int pushnosrc(int size);
	int pushpnt(void* pnt);

	int deftab(int size);

	void listing();
	char* errorname(int err);
	void dump();
};

// structures en mémoire

// structure d'une référence
#define REF_LENGTH 10
#define REF_NAME 0	// nom de la référence
#define REF_VAL 1	// valeur de la référence
#define REF_CODE 2	// >=0 nb d'arguments de la fonction, sinon voir CODE_*
#define REF_TYPE 3	// graphe de type de la référence
#define REF_NEXT 4	// suivant dans la table de hachage
#define REF_NEXTALL 5	// suivant dans la liste globale du package
#define REF_PACKAGE 6

//// les champs suivants ne sont - pour l'instant - remplis que pour
//// les CODE_VAR et les CODE_CONST
#define REF_USED 7       // 0 au debut, 1 de plus à chaque fois que la
												 // référence est utilisée
#define REF_SET 8     // pour les var. 0 si la var ne reçoit jamais de
											// valeur, 1 si elle a seulement une valeur
											// donnée à la déclaration, et 2 si elle est
											// 'set'-ée dans le programme
#define REF_USED_IN_IFDEF 9  // 0 au début, 1 de plus à chaque fois que
													   // la ref est utlisée comme condition dans
													   // un ifdef

#define CODE_TYPE -1	// type
#define CODE_VAR -2	// variable
#define CODE_SUM -3	// type somme
#define CODE_STRUCT -4	// type struct
#define CODE_EMPTYTYPE -5	// type pré-défini
#define CODE_FIELD -6	// champ de structure
#define CODE_CONS -7	// constructeur de type somme
#define CODE_CONS0 -8	// constructeur de type somme sans valeur
#define CODE_CONST -9 // valeur constante


// structure de lien d'un champ vers le type
#define FIELD_LENGTH 2
#define FIELD_NUM 0	// numéro du champ
#define FIELD_TYPE 1	// pointeur vers la référence du type (contient le nombre de champs de la structure)

// structure d'une fonction
#define FUN_LENGTH 6
#define FUN_NBARGS 0	// nb arguments de la fonction
#define FUN_NBLOCALS 1	// nb locals+args de la fonction
#define FUN_BC 2	// bytecode
#define FUN_REF 3	// table des références globales
#define FUN_SUPPARGS 4	// liste des arguments attachés
#define FUN_REFERENCE 5	// pointeur vers la référence de la fonction

// structure d'une liste
#define LIST_LENGTH 2
#define LIST_VAL 0
#define LIST_NEXT 1

// structure de type
#define TYPEHEADER_LENGTH 3
#define TYPEHEADER_CODE 0 // entier TYPENAME_*
#define TYPEHEADER_ACTUAL 1
#define TYPEHEADER_COPY 2


#define TYPENAME_UNDEF 0
#define TYPENAME_FUN 1
#define TYPENAME_LIST 2
#define TYPENAME_TUPLE 3
#define TYPENAME_TAB 4
#define TYPENAME_WEAK 5
#define TYPENAME_CORE 6
#define TYPENAME_REC 7

// structure d'un package
#define PACK_LENGTH 3
#define PACK_NAME 0
#define PACK_HACH 1
#define PACK_NEXT 2


void AbortMetal(Memory* m,int donotstop);

// defines publics

#define PRINTF(m) ((m)->term->printf)

#define TYPE_BINARY 0	// type binaire pour allocation
#define TYPE_TAB 1	// type table pour allocation
#define TYPE_EXT 2	// type externe pour allocation

#define PNTTOVAL(p) (1+((int)(p)))	// conversion pointeur vers mot metal
#define INTTOVAL(i) ((i)<<1)	// conversion entier vers mot metal
#define FLOATTOVAL(v) ((~1)&(*(int*)(&(v))))	// conversion flottant vers mot metal

#define VALTOPNT(v) ((int*)((v)-1))	// conversion mot metal vers pointeur
#define VALTOINT(v) ((v)>>1)	// conversion mot metal vers entier
#define VALTOFLOAT(v) (*((mtl_float*)(&(v))))	// conversion mot metal vers flottant

#define NIL (1)	// nil
#define ISVALPNT(v) ((v)&1)	// teste si un mot metal est un pointeur

#define MALLOC(m,size,type) (m->malloc(size,type))	// allocation d'un bloc
#define MALLOCCLEAR(m,size) (m->mallocClear(size))	// allocation d'un bloc de type table, initialisé à nil
#define MALLOCEXT(m,pnt,fun) (m->mallocExternal(pnt,fun))	// allocation de type TYPE_EXT (la fonction fun(pnt) sera appelée lors de l'oubli du bloc)
#define MALLOCBIN(m,size) (m->malloc(((size)+3)>>2,TYPE_BINARY))	// allocation de type TYPE_BINARY en spécifiant la taille en octets

#define PUSHMALLOC(m,size,type) (m->pushmalloc(size,type))	// allocation d'un bloc
#define PUSHMALLOCCLEAR(m,size) (m->pushmallocClear(size))	// allocation d'un bloc de type table, initialisé à nil
#define PUSHMALLOCBIN(m,size) (m->pushmalloc(((size)+3)>>2,TYPE_BINARY))	// allocation de type TYPE_BINARY en spécifiant la taille en octets
#define PUSHPNT(m,pnt) (m->pushpnt(pnt))	// allocation de type TYPE_BINARY pour stocker un pointeur

#define EXTPUSH(m,pnt,fun) (m->pushExternal(pnt,fun))	// allocation de type TYPE_EXT (la fonction fun(pnt) sera appelée lors de l'oubli du bloc)
#define EXTFORGET(p) (p[HEADER_LENGTH]=p[HEADER_LENGTH+1]=0)	// supprime les références d'un type externe
#define EXTVAL(p) ((void*)(p)[HEADER_LENGTH])	// retourne l'objet externe
#define TABSET(m,p,i,val) (m->tabset(p,i,val)) // règle une valeur d'une table
#define TABGET(p,i)	(p[HEADER_LENGTH+(i)])	// lit une valeur d'une table
#define TABSTART(p) (&p[HEADER_LENGTH])	// pointeur vers la première case d'une table
#define TABLEN(p) (HEADER_SIZE(p)-HEADER_LENGTH)	// taille de la table
#define BINSTART(p) (&p[HEADER_LENGTH])	// pointeur vers le début d'un bloc binaire

#define STACKGET(m,i) ((m)->stack.pp[-(i)])	// retourne le n-ieme élément de la pile
#define STACKSET(m,i,val) ((m)->stackset(&(m)->stack.pp[-(i)],val))	// règle le n-ieme élément de la pile
#define STACKPULL(m) (*(m)->stack.pp--)	// dépile un élément de la pile
#define STACKDROP(m) ((m)->stack.pp--)	// supprime 1 élément de la pile
#define STACKDROPN(m,n) ((m)->stack.pp-=(n))	// supprime n éléments de la pile
#define STACKPUSH(m,val) ((m)->push(val))	// empile un nouvel élément (retourne non nul si out of memory)

#define STACKREF(m) ((m)->stack.pp-(m)->stack.base)	// retourne une référence correspondant à la taille actuelle de la pile
#define STACKRESTOREREF(m,size) ((m)->stack.pp=(m)->stack.base+size)	// redéfinit la taille de la pile en fonction de la référence
#define STACKGETFROMREF(m,size,i) ((m)->stack.base[(size)-(i)])	// lit le n-ieme élément à partir d'une référence
#define STACKSETFROMREF(m,size,i,val) ((m)->stackset(&(m)->stack.base[(size)-(i)],val))	// règle le l-ieme élément à partir d'une référence

#define STRSTART(p) ((char*)&p[HEADER_LENGTH+1])	// retourne le début d'une chaîne
#define STRLEN(p) (p[HEADER_LENGTH])	// retourne la longueur d'une chaîne
#define STRSETLEN(p,size) (p[HEADER_LENGTH]=(size))	// définit la longueur de la chaîne
#define STRSTORE(m,src) (m->storestring(src))	// stocke une chaîne
#define STRSTOREBINARY(m,src,size) (m->storebinary(src,size))	// stocke un buffer binaire
#define STRSTORENOSRC(m,size) (m->storenosrc(size))	// stocke un buffer binaire

#define STRPUSH(m,src) (m->pushstring(src))	// stocke une chaîne
#define STRPUSHBINARY(m,src,size) (m->pushbinary(src,size))	// stocke un buffer binaire
#define STRPUSHNOSRC(m,size) (m->pushnosrc(size))	// stocke un buffer binaire

#define DEFTAB(m,size) (m->deftab(size))	// crée un tuple avec les éléments dans la pile et empile le tuple


#define MTLERR_ENDINTERPRETER 1
#define MTLERR_OM -1
#define MTLERR_OP -2
#define MTLERR_DIV -3
#define MTLERR_RET -4
#define MTLERR_NOFUN -5
#define MTLERR_SN -6
#define MTLERR_TYPE -7
#define MTLERR_ABORT -8

#define LOG_RUNTIME 1
#define LOG_WARNING 2
#define LOG_DEVCORE 4
#define LOG_COMPILER 8
#define LOG_USER 16

inline int Memory::push(int val)
{
	*(++stack.pp)=val;
	if ((stack.pp-stack.base)>=stack.size-1)
	{
		int k; if ((k=stack.bigger(this))) return k;
//	term->printf(LOG_DEVCORE,"## bigger stack %d\n",stack.size);
//	stackprint(0);
	}
	return 0;
}

inline void Memory::tabset(int* p,int i,int val)
{
	p[HEADER_LENGTH+i]=val;	// règle une valeur d'une table
}

inline void Memory::stackset(int* p,int val)
{
	*p=val;
}

inline int Memory::pushmalloc(int size,int type)
{
	int* p=malloc(size,type); if (!p) return MTLERR_OM;
	return push(PNTTOVAL(p));
}

inline int Memory::pushmallocClear(int size)
{
	int* p=mallocClear(size); if (!p) return MTLERR_OM;
	return push(PNTTOVAL(p));
}

inline int Memory::pushstring(char* src)
{
	int* p=storestring(src); if (!p) return MTLERR_OM;
	return push(PNTTOVAL(p));
}

inline int Memory::pushbinary(char* src,int size)
{
	int* p=storebinary(src,size); if (!p) return MTLERR_OM;
	return push(PNTTOVAL(p));
}

inline int Memory::pushnosrc(int size)
{
	int* p=storenosrc(size); if (!p) return MTLERR_OM;
	return push(PNTTOVAL(p));
}

inline int Memory::pushpnt(void* pnt)
{
	int* p=malloc(1,TYPE_BINARY); if (!p) return MTLERR_OM;
	*(BINSTART(p))=(int)pnt;
	return push(PNTTOVAL(p));
}

#endif
