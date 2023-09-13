CXXFLAGS=-m32 -Wno-write-strings
CFLAGS=-m32 -Wno-write-strings

OBJS = \
	bootstrap.o \
	compiler_file.o \
	compiler.o \
	compiler_prog.o \
	compiler_term.o \
	compiler_type.o \
	compiler_var.o \
	file.o \
	interpreter.o \
	memory.o \
	parser.o \
	parser_xml.o \
	prodbuffer.o \
	stdlib_core.o \
	terminal.o \
	util.o

libvcomp.a : $(OBJS)
	ar rcs $@ $(OBJS)
	ranlib $@

clean :
	rm -f $(OBJS)
