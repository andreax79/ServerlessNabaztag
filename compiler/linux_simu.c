#ifdef USE_GLUT
#ifdef __APPLE__
#include <GLUT/glut.h>
#else
#include <GL/glut.h>
#endif
#endif

#define PROTORABBIT
//#define PROTODAL

// commenter la ligne suivante pour la version windows
//#define VMICROCHIP

typedef unsigned char uchar;
typedef unsigned long ulong;

#define vub unsigned char
#define vsb signed char

#define vuw unsigned short int
#define vsw signed short int

#define vud unsigned long
#define vsd signed long


void checkAllEvents(void);


#ifdef PROTORABBIT
#define VLISP_HARDWARE "NAB2"
#define NBLED 15
#define VL_MOTORS
#define VL_MUSIC
#define VL_3STATE
#define NBMOTOR 2
#endif

#ifdef PROTODAL
#define VLISP_HARDWARE "4"
#define NBLED 27
#define VL_PRESS
#endif

#ifdef VMICROCHIP
int simuInit(){ return 0;}
int simuDoLoop(){ return 0;}
void simuSetLed(vub i,vub val){}
void simuSetMotor(vub i,vub val){}

#else
#include<stdio.h>
#include<stdlib.h>
#include<string.h>
#include<time.h>

#include "linux_simuaudio.h"
#include "linux_simunet.h"
#include "log.h"

// définition de l'échelle d'affichage de la simulation
#define SCALE 2

#define NBHOLES 20
#define MASKEDHOLES 3
// MAXMOTORVAL doit être inférieur à 256
#define MOTORSCALE 1
#define MAXMOTORVAL 100

int motorwheel[256];

// gestion des couleurs
// ---------------------
uchar coloradd[256*256];
uchar colormul[256*256];

#define COLORADD(x,y) (coloradd[(x)+((y)<<8)])
#define COLORMUL(x,y) (colormul[(x)+((y)<<8)])

#define RGBTOINT(r,g,b) (( (((int)r)&255)<<16)+((((int)g)&255)<<8)+(((int)b)&255))
#define INTTOR(c) ((c>>16)&255)
#define INTTOG(c) ((c>>8)&255)
#define INTTOB(c) (c&255)

// initialisation des tables de couleur
void colortabInit()
{
	int i,j,k;

	for(i=0;i<256;i++)
		for(j=0;j<256;j++)
		{
			k=i+j;
			coloradd[i+(j<<8)]=(k<=255)?k:255;

			k=i*j/255;
			colormul[i+(j<<8)]=k;
		}
}

// définition physique des leds

// en fait il y a NBLED/3 leds, mais on en met 3 fois plus pour
// pouvoir séparer chacune des composantes rgb de la couleur de chaque
// led
int diodeval[NBLED];
#ifdef VL_MOTORS
int motorval[NBMOTOR];
int motorcount[NBMOTOR];
int motordir[NBMOTOR];
#endif

int xclicsimu=-1;
int yclicsimu=-1;
int rclicsimu=0;
int movesimu=0;

int lastmovex=0;
int lastmovey=0;

#ifdef PROTORABBIT
int diodex[NBLED]={80,80,80,40,40,40,80,80,80,120,120,120,80,80,80};
int diodey[NBLED]={40,40,40,90,90,90,90,90,90,90,90,90,130,130,130};
int diodergb[NBLED]=
{0x0000ff,0x00ff00,0xff0000,
0x0000ff,0x00ff00,0xff0000,
0x0000ff,0x00ff00,0xff0000,
0x0000ff,0x00ff00,0xff0000,
0x0000ff,0x00ff00,0xff0000
};
#endif

#ifdef PROTODAL
int diodex[NBLED]={40,40,40,80,80,80,120,120,120,40,40,40,80,80,80,120,120,120,40,40,40,80,80,80,120,120,120};
int diodey[NBLED]={40,40,40,40,40,40,40,40,40,80,80,80,80,80,80,80,80,80,120,120,120,120,120,120,120,120,120};
int diodergb[NBLED]=
{0x0000ff,0x00ff00,0xff0000,
0x0000ff,0x00ff00,0xff0000,
0x0000ff,0x00ff00,0xff0000,
0x0000ff,0x00ff00,0xff0000,
0x0000ff,0x00ff00,0xff0000,
0x0000ff,0x00ff00,0xff0000,
0x0000ff,0x00ff00,0xff0000,
0x0000ff,0x00ff00,0xff0000,
0x0000ff,0x00ff00,0xff0000
};
#endif


// TODO
int getButton() { return 0; }

// fonction d'affichage des diodes
int simuDisplay(int* intensity)
{
	// TODO afficher l'état du lapin
	return 0;
}

#ifdef USE_GLUT
void reshape(int width, int height)
{
    glViewport(0, 0, width, height);
}

static float white_color[4] = { 1.0, 1.0, 1.0, 1.0 };
static float red_color[4] = { 1.0, 0.0, 0.0, 1.0 };
static float no_color[4] = { 0.0, 0.0, 0.0, 0.0 };

void display(void)
{
	float led_color[4] = { 0.0, 0.0, 0.0, 0.7 };
	
	glLoadIdentity();
	glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);
	
//	glRotatef(0.1, 0, 1, 0);
	
	glPushMatrix();
		glMaterialfv(GL_FRONT, GL_DIFFUSE, white_color);
		glMaterialfv(GL_FRONT, GL_EMISSION, white_color);
		glColor4fv(white_color);	
	
		// draw the head
		glTranslatef(0, .25, 0);
		glutSolidSphere(0.25, 50, 50);
		// draw the body
		glTranslatef(0, -0.5, 0);
		glRotatef(-90, 1, 0, 0);
		gluCylinder(gluNewQuadric(), .375, .25, .5, 50, 50);
	glPopMatrix();
	
	// draw the left ear
	glPushMatrix();
		glTranslatef(0, .25, 0);	
		glRotatef(-90, 1, 0, 0);
		glTranslatef(.22, 0, 0);
		glRotatef(15, 0, 1, 0);
		glRotatef((motorval[0]>>MOTORSCALE)*3.6, 1, 0, 1);
		glMaterialfv(GL_FRONT, GL_EMISSION, red_color);
		gluCylinder(gluNewQuadric(), .05, .05, .5, 50, 50);
	glPopMatrix();

	// draw the right ear
	glPushMatrix();
		glTranslatef(0, .25, 0);	
		glRotatef(-90, 1, 0, 0);
		glTranslatef(-.22, 0, 0);
		glRotatef(-15, 0, 1, 0);
		glRotatef((motorval[1]>>MOTORSCALE)*3.6, -1, 0, 1);
		glMaterialfv(GL_FRONT, GL_EMISSION, red_color);
		gluCylinder(gluNewQuadric(), .05, .05, .5, 50, 50);
	glPopMatrix();
	
	
	// now let's draw some LEDS
	
	glPushMatrix();
		// the base
		glTranslatef(0, -0.35, 0);
		glRotatef(-90, 1, 0, 0);
		led_color[0] = diodeval[12] / 255.0f;
		led_color[1] = diodeval[13] / 255.0f;
		led_color[2] = diodeval[14] / 255.0f;
		glMaterialfv(GL_FRONT, GL_EMISSION, led_color);
		gluCylinder(gluNewQuadric(), .25, .375, .1, 50, 50);
	glPopMatrix();
	
	glPushMatrix();
		// the nose
		glTranslatef(0, .25, -0.25);
		led_color[0] = diodeval[0] / 255.0f;
		led_color[1] = diodeval[1] / 255.0f;
		led_color[2] = diodeval[2] / 255.0f;
		glMaterialfv(GL_FRONT, GL_EMISSION, led_color);
		glutSolidSphere(0.05, 50, 50);	
	glPopMatrix();

	glPushMatrix();
		// the left led
		glTranslatef(-0.25, -0.125, -0.25);
		led_color[0] = diodeval[3] / 255.0f;
		led_color[1] = diodeval[4] / 255.0f;
		led_color[2] = diodeval[5] / 255.0f;
		glMaterialfv(GL_FRONT, GL_EMISSION, led_color);
		glutSolidSphere(0.05, 50, 50);	
	glPopMatrix();

	glPushMatrix();
		// the middle led
		glTranslatef(0, -0.125, -0.375);
		led_color[0] = diodeval[6] / 255.0f;
		led_color[1] = diodeval[7] / 255.0f;
		led_color[2] = diodeval[8] / 255.0f;
		glMaterialfv(GL_FRONT, GL_EMISSION, led_color);
		glutSolidSphere(0.05, 50, 50);	
	glPopMatrix();

	glPushMatrix();
		// the right led
		glTranslatef(0.25, -0.125, -0.25);
		led_color[0] = diodeval[9] / 255.0f;
		led_color[1] = diodeval[10] / 255.0f;
		led_color[2] = diodeval[11] / 255.0f;
		glMaterialfv(GL_FRONT, GL_EMISSION, led_color);
		glutSolidSphere(0.05, 50, 50);	
	glPopMatrix();
	
	glutSwapBuffers();
}
#endif

// initialisation du simulateur
vsd simuInit()
{
	int i;
	colortabInit();

	for(i=0;i<NBLED;i++) diodeval[i]=255;
	srand(clock());
#ifdef VL_MOTORS
	for(i=0;i<NBMOTOR;i++)
	{
		motorval[i]=60<<MOTORSCALE;
		motorcount[i]=motordir[i]=0; 
	}
	for(i=0;i<256;i++) motorwheel[i]=0;
	for(i=0;i<MAXMOTORVAL;i++)
	{
		if ((i*2*NBHOLES/MAXMOTORVAL)&1) motorwheel[i]=1;
		if (i*NBHOLES/MAXMOTORVAL>=NBHOLES-MASKEDHOLES) motorwheel[i]=1;
	}
#endif
//	setButton(1);
	simuaudioinit();
	simunetinit();
	
#ifdef USE_GLUT
	glutDisplayFunc(display);
	glutReshapeFunc(reshape);
#endif
	return 0;
}



// fonction à appeler régulièrement, pour traiter les messages de la fenêtre du simulateur
vsd simuDoLoop()
{
#ifdef VL_MOTORS
	int i,last;
#endif

	checkAllEvents();

#ifdef VL_MOTORS
	for(i=0;i<NBMOTOR;i++)
	{
		last=motorwheel[motorval[i]>>MOTORSCALE];
		if (1) motorval[i]+=motordir[i];
		if (motorval[i]<0) motorval[i]+=(MAXMOTORVAL<<MOTORSCALE);
		if (motorval[i]>=(MAXMOTORVAL<<MOTORSCALE)) motorval[i]-=(MAXMOTORVAL<<MOTORSCALE);
		if (last<motorwheel[motorval[i]]) motorcount[i]++;
	}
#endif
	simuDisplay(diodeval);
	return 0;
}


/**
	 Vérifie tous les évènements et fait les actions appropriées
 */
void checkAllEvents(void)
{
	checkNetworkEvents();
}


// réglagle d'une led
void simuSetLed(int i,int val)
{
	i*=3;
	if ((i<0)||(i>=NBLED)) return;
	diodeval[i]=(val>>16)&255;
	diodeval[i+1]=(val>>8)&255;
	diodeval[i+2]=(val)&255;

	my_printf(LOG_SIMULEDS, "Setting led %d: [%d %d %d]\n", i/3, diodeval[i], diodeval[i+1], diodeval[i+2]);
	my_printf(LOG_SIMULEDS, "All leds state:", i/3, diodeval[i], diodeval[i+1], diodeval[i+2]);
	for (i=0; i<NBLED/3; ++i)
		{
			my_printf(LOG_SIMULEDS, " [%3d %3d %3d]", diodeval[3*i], diodeval[3*i+1], diodeval[3*i+2]);
		}
	my_printf(LOG_SIMULEDS, "\n");
	
#ifdef USE_GLUT
	glutPostRedisplay();
#endif	
}

#ifdef VL_MOTORS
// réglagle d'un moteur
void set_motor_dir(int num_motor, int sens)
{
	int tmp_num, tmp_sens;
	tmp_num = num_motor?1:0;
	tmp_sens = (sens==0)?0:((sens==1)?1:-1);
	motordir[tmp_num]=tmp_sens;

	my_printf(LOG_SIMUMOTORS, "Setting motor %d, direction %d (pos: %d)\n", tmp_num, tmp_sens);
}

int get_motor_val(int i)
{
	int tmp_num = i?1:0;
	my_printf(LOG_SIMUMOTORS, "Getting value for motor %d: %d\n", tmp_num, motorcount[tmp_num]);
	return motorcount[tmp_num];
}
#else
int get_motor_val(int i)
{
	return 128;
}
#endif

int get_button3()
{
	// TODO
	return 0;
}

char buf_rfid[256];

char* get_rfid()
{
	// TODO
	return NULL;
}
#endif
