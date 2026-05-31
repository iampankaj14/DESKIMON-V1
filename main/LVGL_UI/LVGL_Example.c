#include "LVGL_Example.h"
#include "LVGL_Music.h"
#include <demos/lv_demos.h>
// #include <demos/music/lv_demo_music_main.h>
// #include <demos/music/lv_demo_music_list.h>
#include "../QMI8658/QMI8658.h"
#include <stdlib.h> // for rand()

// State definitions
typedef enum {
    EYE_STATE_BOOT = 0,
    EYE_STATE_NORMAL,
    EYE_STATE_BORED,
    EYE_STATE_HAPPY,
    EYE_STATE_ANGRY,
    EYE_STATE_SLEEP
} eye_state_t;

static eye_state_t current_state = EYE_STATE_BOOT;
static lv_obj_t * eye_l;
static lv_obj_t * eye_r;
static lv_obj_t * mask_moon_l;
static lv_obj_t * mask_moon_r;
static lv_obj_t * mask_top_l;
static lv_obj_t * mask_top_r;

static lv_timer_t * logic_timer = NULL;
static uint32_t state_time = 0;
static uint32_t idle_time = 0;
static uint32_t next_look_time = 3000;

static float last_accel_x = 0;
static float last_accel_y = 0;
static float last_accel_z = 0;

static int tap_count = 0;
static uint32_t last_tap_time = 0;

// Animation helpers for smooth transitions
static void set_width_cb(void * var, int32_t v) { lv_obj_set_width((lv_obj_t *)var, v); }
static void set_height_cb(void * var, int32_t v) { lv_obj_set_height((lv_obj_t *)var, v); }
static void set_radius_cb(void * var, int32_t v) { lv_obj_set_style_radius((lv_obj_t *)var, v, 0); }
static void set_angle_cb(void * var, int32_t v) { lv_obj_set_style_transform_angle((lv_obj_t *)var, v, 0); }
static void set_translate_x_cb(void * var, int32_t v) { lv_obj_set_style_translate_x((lv_obj_t *)var, v, 0); }
static void set_translate_y_cb(void * var, int32_t v) { lv_obj_set_style_translate_y((lv_obj_t *)var, v, 0); }

static void anim_property(lv_obj_t * obj, lv_anim_exec_xcb_t exec_cb, int32_t start, int32_t end, uint32_t time) {
    lv_anim_t a;
    lv_anim_init(&a);
    lv_anim_set_var(&a, obj);
    lv_anim_set_values(&a, start, end);
    lv_anim_set_time(&a, time);
    lv_anim_set_exec_cb(&a, exec_cb);
    lv_anim_set_path_cb(&a, lv_anim_path_ease_in_out);
    lv_anim_start(&a);
}

static void animate_eye_base(lv_obj_t * eye, int32_t w, int32_t h, int32_t r, int32_t angle, int32_t tx, int32_t ty, uint32_t time) {
    anim_property(eye, set_width_cb, lv_obj_get_width(eye), w, time);
    anim_property(eye, set_height_cb, lv_obj_get_height(eye), h, time);
    anim_property(eye, set_radius_cb, lv_obj_get_style_radius(eye, 0), r, time);
    anim_property(eye, set_angle_cb, lv_obj_get_style_transform_angle(eye, 0), angle, time);
    anim_property(eye, set_translate_x_cb, lv_obj_get_style_translate_x(eye, 0), tx, time);
    anim_property(eye, set_translate_y_cb, lv_obj_get_style_translate_y(eye, 0), ty, time);
}

static void hide_masks(uint32_t time) {
    anim_property(mask_top_l, set_translate_y_cb, lv_obj_get_style_translate_y(mask_top_l, 0), -300, time);
    anim_property(mask_top_r, set_translate_y_cb, lv_obj_get_style_translate_y(mask_top_r, 0), -300, time);
    anim_property(mask_moon_l, set_translate_y_cb, lv_obj_get_style_translate_y(mask_moon_l, 0), -300, time);
    anim_property(mask_moon_r, set_translate_y_cb, lv_obj_get_style_translate_y(mask_moon_r, 0), -300, time);
}

static void set_eyes_state(eye_state_t new_state) {
    if (current_state == new_state) return;
    current_state = new_state;
    state_time = 0;
    
    // Default to pure cyan color unless angry/sleep
    if (new_state != EYE_STATE_ANGRY && new_state != EYE_STATE_SLEEP) {
        lv_obj_set_style_bg_color(eye_l, lv_color_hex(0x00FFFF), 0);
        lv_obj_set_style_bg_color(eye_r, lv_color_hex(0x00FFFF), 0);
    }
    
    switch (new_state) {
        case EYE_STATE_NORMAL:
            animate_eye_base(eye_l, 100, 165, LV_RADIUS_CIRCLE, 0, 0, 0, 400);
            animate_eye_base(eye_r, 100, 165, LV_RADIUS_CIRCLE, 0, 0, 0, 400);
            hide_masks(400);
            next_look_time = 1000;
            break;
            
        case EYE_STATE_BORED:
            // Bored: Half cut via top mask. Base eyes remain pill shaped.
            animate_eye_base(eye_l, 100, 165, LV_RADIUS_CIRCLE, 0, 0, 0, 500);
            animate_eye_base(eye_r, 100, 165, LV_RADIUS_CIRCLE, 0, 0, 0, 500);
            hide_masks(500);
            // Slide top masks down to cover top half. Mask is 110x120.
            // Align is TOP_MID, translating to -30 means it covers Y from -30 to +90.
            // This perfectly hides the entire upper 90 pixels of the eye with no leaks on top or sides.
            anim_property(mask_top_l, set_translate_y_cb, lv_obj_get_style_translate_y(mask_top_l, 0), -30, 500);
            anim_property(mask_top_r, set_translate_y_cb, lv_obj_get_style_translate_y(mask_top_r, 0), -30, 500);
            break;
            
        case EYE_STATE_HAPPY:
            // Happy: Crescent moon via round mask.
            animate_eye_base(eye_l, 100, 165, LV_RADIUS_CIRCLE, 0, 0, 0, 400);
            animate_eye_base(eye_r, 100, 165, LV_RADIUS_CIRCLE, 0, 0, 0, 400);
            hide_masks(400);
            // Slide moon masks down (y=40) so they cover the BOTTOM, leaving a crescent at the TOP
            anim_property(mask_moon_l, set_translate_y_cb, lv_obj_get_style_translate_y(mask_moon_l, 0), 40, 400);
            anim_property(mask_moon_r, set_translate_y_cb, lv_obj_get_style_translate_y(mask_moon_r, 0), 40, 400);
            break;
            
        case EYE_STATE_ANGRY:
            // Angry: Exact same face as bored, but red color
            lv_obj_set_style_bg_color(eye_l, lv_color_hex(0xFF0000), 0);
            lv_obj_set_style_bg_color(eye_r, lv_color_hex(0xFF0000), 0);
            animate_eye_base(eye_l, 100, 165, LV_RADIUS_CIRCLE, 0, 0, 0, 300); 
            animate_eye_base(eye_r, 100, 165, LV_RADIUS_CIRCLE, 0, 0, 0, 300);
            hide_masks(300);
            // Slide top masks down to cover top half (same as Bored)
            anim_property(mask_top_l, set_translate_y_cb, lv_obj_get_style_translate_y(mask_top_l, 0), -30, 300);
            anim_property(mask_top_r, set_translate_y_cb, lv_obj_get_style_translate_y(mask_top_r, 0), -30, 300);
            break;
            
        case EYE_STATE_SLEEP:
            // Sleep: Slightly dark cyan squashed pill, broken into two separate parts
            hide_masks(500);
            lv_obj_set_style_bg_color(eye_l, lv_color_hex(0x005555), 0);
            lv_obj_set_style_bg_color(eye_r, lv_color_hex(0x005555), 0);
            animate_eye_base(eye_l, 90, 25, LV_RADIUS_CIRCLE, 0, 0, 40, 800); 
            animate_eye_base(eye_r, 90, 25, LV_RADIUS_CIRCLE, 0, 0, 40, 800);
            break;
            
        default: break;
    }
}

static void logic_timer_cb(lv_timer_t * t)
{
    state_time += 100;
    idle_time += 100;

    // Check Accelerometer for shaking/movement
    getAccelerometer();
    float dx = Accel.x - last_accel_x;
    float dy = Accel.y - last_accel_y;
    float dz = Accel.z - last_accel_z;
    float move_amt = (dx*dx) + (dy*dy) + (dz*dz);
    last_accel_x = Accel.x;
    last_accel_y = Accel.y;
    last_accel_z = Accel.z;

    if (move_amt > 0.05f) { // Normal movement
        idle_time = 0;
        if (current_state == EYE_STATE_BORED || current_state == EYE_STATE_SLEEP) {
            set_eyes_state(EYE_STATE_NORMAL);
        }
    }
    
    if (move_amt > 1.5f) { // Violent shake
        idle_time = 0;
        if (current_state != EYE_STATE_ANGRY) {
            set_eyes_state(EYE_STATE_ANGRY);
        }
    }

    // Handle state logic
    if (current_state == EYE_STATE_BOOT) {
        if (state_time == 2000) {
            // Look right
            animate_eye_base(eye_l, 100, 165, LV_RADIUS_CIRCLE, 0, 50, 0, 600);
            animate_eye_base(eye_r, 100, 165, LV_RADIUS_CIRCLE, 0, 50, 0, 600);
        } else if (state_time == 5000) {
            // Look left
            animate_eye_base(eye_l, 100, 165, LV_RADIUS_CIRCLE, 0, -50, 0, 800);
            animate_eye_base(eye_r, 100, 165, LV_RADIUS_CIRCLE, 0, -50, 0, 800);
        } else if (state_time == 7000) {
            // Center
            animate_eye_base(eye_l, 100, 165, LV_RADIUS_CIRCLE, 0, 0, 0, 500);
            animate_eye_base(eye_r, 100, 165, LV_RADIUS_CIRCLE, 0, 0, 0, 500);
        } else if (state_time == 8000) {
            set_eyes_state(EYE_STATE_BORED); // Immediately bored after boot as requested
        }
    } 
    else if (current_state == EYE_STATE_NORMAL) {
        if (idle_time > 10000) { // 10 seconds of pure idle
            set_eyes_state(EYE_STATE_SLEEP);
        } else {
            // Realistic random looking
            if (state_time >= next_look_time) {
                int32_t rx = (rand() % 100) - 50; // -50 to 50
                int32_t ry = (rand() % 60) - 30;  // -30 to 30
                uint32_t speed = (rand() % 400) + 200; // 200ms to 600ms transition
                
                animate_eye_base(eye_l, 100, 165, LV_RADIUS_CIRCLE, 0, rx, ry, speed);
                animate_eye_base(eye_r, 100, 165, LV_RADIUS_CIRCLE, 0, rx, ry, speed);
                
                next_look_time = state_time + speed + (rand() % 3000) + 1000; // Wait 1s-4s before next look
            }
        }
    }
    else if (current_state == EYE_STATE_HAPPY) {
        if (state_time > 3000) {
            set_eyes_state(EYE_STATE_NORMAL);
        }
    }
    else if (current_state == EYE_STATE_ANGRY) {
        if (state_time > 6000) { // Stay angry for 6 seconds unconditionally
            set_eyes_state(EYE_STATE_NORMAL);
        }
    }
}

static void screen_event_cb(lv_event_t * e) {
    lv_event_code_t code = lv_event_get_code(e);
    if (code == LV_EVENT_PRESSED) {
        idle_time = 0; // Wake up immediately
        
        if (current_state == EYE_STATE_BORED || current_state == EYE_STATE_SLEEP) {
            set_eyes_state(EYE_STATE_NORMAL);
            return;
        }

        uint32_t now = lv_tick_get();
        if (now - last_tap_time < 600) { 
            tap_count++;
        } else {
            tap_count = 1;
        }
        last_tap_time = now;
        
        if (tap_count >= 3) { // 3 or more taps
            set_eyes_state(EYE_STATE_ANGRY);
        } else if (tap_count == 1) {
            if (current_state != EYE_STATE_BOOT && current_state != EYE_STATE_ANGRY) {
                set_eyes_state(EYE_STATE_HAPPY);
            }
        }
    }
}

static void create_eye_masks(lv_obj_t * eye, lv_obj_t ** top_mask, lv_obj_t ** moon_mask) {
    // Mask for bored face (cuts top half). Made slightly wider and tall to perfectly cover everything.
    *top_mask = lv_obj_create(eye);
    lv_obj_set_size(*top_mask, 110, 120); 
    lv_obj_set_style_bg_color(*top_mask, lv_color_black(), 0);
    lv_obj_set_style_border_width(*top_mask, 0, 0);
    lv_obj_set_style_radius(*top_mask, 0, 0); // Flat bottom to cut a straight line
    lv_obj_align(*top_mask, LV_ALIGN_TOP_MID, 0, 0);
    lv_obj_set_style_translate_y(*top_mask, -300, 0); // Hidden
    lv_obj_clear_flag(*top_mask, LV_OBJ_FLAG_SCROLLABLE);

    // Mask for happy face (moon crescent cut)
    *moon_mask = lv_obj_create(eye);
    lv_obj_set_size(*moon_mask, 100, 165); // Same size as eye
    lv_obj_set_style_bg_color(*moon_mask, lv_color_black(), 0);
    lv_obj_set_style_border_width(*moon_mask, 0, 0);
    lv_obj_set_style_radius(*moon_mask, LV_RADIUS_CIRCLE, 0); // Round to cut a crescent
    lv_obj_align(*moon_mask, LV_ALIGN_CENTER, 0, 0);
    lv_obj_set_style_translate_y(*moon_mask, -300, 0); // Hidden
    lv_obj_clear_flag(*moon_mask, LV_OBJ_FLAG_SCROLLABLE);
}

static void Deskimon_Create(void)
{
    lv_obj_t * scr = lv_scr_act();
    lv_obj_add_event_cb(scr, screen_event_cb, LV_EVENT_ALL, NULL);

    // Black background
    lv_obj_set_style_bg_color(scr, lv_color_black(), 0);
    lv_obj_set_style_bg_opa(scr, LV_OPA_COVER, 0);

    // LEFT EYE
    eye_l = lv_obj_create(scr);
    lv_obj_set_size(eye_l, 100, 165);
    lv_obj_set_style_radius(eye_l, LV_RADIUS_CIRCLE, 0);
    lv_obj_set_style_bg_color(eye_l, lv_color_hex(0x00FFFF), 0); 
    lv_obj_set_style_bg_opa(eye_l, LV_OPA_COVER, 0);
    lv_obj_set_style_border_width(eye_l, 0, 0);
    
    lv_obj_clear_flag(eye_l, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_align(eye_l, LV_ALIGN_CENTER, -60, 0);
    lv_obj_set_style_translate_x(eye_l, 0, 0);
    lv_obj_set_style_translate_y(eye_l, 0, 0);
    
    create_eye_masks(eye_l, &mask_top_l, &mask_moon_l);

    // RIGHT EYE
    eye_r = lv_obj_create(scr);
    lv_obj_set_size(eye_r, 100, 165);
    lv_obj_set_style_radius(eye_r, LV_RADIUS_CIRCLE, 0);
    lv_obj_set_style_bg_color(eye_r, lv_color_hex(0x00FFFF), 0); 
    lv_obj_set_style_bg_opa(eye_r, LV_OPA_COVER, 0);
    lv_obj_set_style_border_width(eye_r, 0, 0);
    
    lv_obj_clear_flag(eye_r, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_align(eye_r, LV_ALIGN_CENTER, 60, 0);
    lv_obj_set_style_translate_x(eye_r, 0, 0);
    lv_obj_set_style_translate_y(eye_r, 0, 0);

    create_eye_masks(eye_r, &mask_top_r, &mask_moon_r);

    // Master logic timer (10Hz)
    logic_timer = lv_timer_create(logic_timer_cb, 100, NULL);
}

/**********************
 *      TYPEDEFS
 **********************/
typedef enum {
    DISP_SMALL,
    DISP_MEDIUM,
    DISP_LARGE,
} disp_size_t;

/**********************
 *  STATIC PROTOTYPES
 **********************/
static void Onboard_create(lv_obj_t * parent);
static void Music_create(lv_obj_t * parent);

static void ta_event_cb(lv_event_t * e);
void example1_increase_lvgl_tick(lv_timer_t * t);
/**********************
 *  STATIC VARIABLES
 **********************/
static disp_size_t disp_size;

static lv_obj_t * tv;
// static lv_obj_t * calendar;
lv_style_t style_text_muted;
lv_style_t style_title;
static lv_style_t style_icon;
static lv_style_t style_bullet;


static const lv_font_t * font_large;
static const lv_font_t * font_normal;

static lv_timer_t * auto_step_timer;
static lv_color_t original_screen_bg_color;

static lv_timer_t * meter2_timer;

lv_obj_t * SD_Size;
lv_obj_t * FlashSize;
lv_obj_t * BAT_Volts;
lv_obj_t * Board_angle;
lv_obj_t * RTC_Time;
lv_obj_t * Wireless_Scan;
lv_obj_t * Backlight_slider;



void auto_switch(lv_timer_t * t)
{
  uint16_t page = lv_tabview_get_tab_act(tv);

  if (page == 0) { 
    lv_tabview_set_act(tv, 1, LV_ANIM_ON); 
  } else if (page == 3) { 
    lv_tabview_set_act(tv, 2, LV_ANIM_ON); 
  }
}

void Lvgl_Example1(void)
{
    Deskimon_Create();
    return;

    disp_size = DISP_SMALL;

    font_large = LV_FONT_DEFAULT;
    font_normal = LV_FONT_DEFAULT;

    // baaki purana code niche rehne de
  lv_coord_t tab_h;
  tab_h = 45;
  #if LV_FONT_MONTSERRAT_18
    font_large     = &lv_font_montserrat_18;
  #else
    LV_LOG_WARN("LV_FONT_MONTSERRAT_18 is not enabled for the widgets demo. Using LV_FONT_DEFAULT instead.");
  #endif
  #if LV_FONT_MONTSERRAT_12
    font_normal    = &lv_font_montserrat_12;
  #else
    LV_LOG_WARN("LV_FONT_MONTSERRAT_12 is not enabled for the widgets demo. Using LV_FONT_DEFAULT instead.");
  #endif
  
  lv_style_init(&style_text_muted);
  lv_style_set_text_opa(&style_text_muted, LV_OPA_90);

  lv_style_init(&style_title);
  lv_style_set_text_font(&style_title, font_large);

  lv_style_init(&style_icon);
  lv_style_set_text_color(&style_icon, lv_theme_get_color_primary(NULL));
  lv_style_set_text_font(&style_icon, font_large);

  lv_style_init(&style_bullet);
  lv_style_set_border_width(&style_bullet, 0);
  lv_style_set_radius(&style_bullet, LV_RADIUS_CIRCLE);

  tv = lv_tabview_create(lv_scr_act(), LV_DIR_TOP, tab_h);

  lv_obj_set_style_text_font(lv_scr_act(), font_normal, 0);

  if(disp_size == DISP_LARGE) {
    lv_obj_t * tab_btns = lv_tabview_get_tab_btns(tv);
    lv_obj_set_style_pad_left(tab_btns, LV_HOR_RES / 2, 0);
    lv_obj_t * logo = lv_img_create(tab_btns);
    LV_IMG_DECLARE(img_lvgl_logo);
    lv_img_set_src(logo, &img_lvgl_logo);
    lv_obj_align(logo, LV_ALIGN_LEFT_MID, -LV_HOR_RES / 2 + 25, 0);

    lv_obj_t * label = lv_label_create(tab_btns);
    lv_obj_add_style(label, &style_title, 0);
    lv_label_set_text(label, "LVGL v8");
    lv_obj_align_to(label, logo, LV_ALIGN_OUT_RIGHT_TOP, 10, 0);

    label = lv_label_create(tab_btns);
    lv_label_set_text(label, "Widgets demo");
    lv_obj_add_style(label, &style_text_muted, 0);
    lv_obj_align_to(label, logo, LV_ALIGN_OUT_RIGHT_BOTTOM, 10, 0);
  }

  lv_obj_t * t0 = lv_tabview_add_tab(tv, "       ");
  lv_obj_t * t1 = lv_tabview_add_tab(tv, "Onboard");
  lv_obj_t * t2 = lv_tabview_add_tab(tv, "music");
  lv_obj_t * t3 = lv_tabview_add_tab(tv, "       ");

  LV_UNUSED(t0);  
  LV_UNUSED(t3);  
  Onboard_create(t1);
  Music_create(t2);
  lv_timer_create(auto_switch, 100, NULL);
  
}

void Lvgl_Example1_close(void)
{
  /*Delete all animation*/
  lv_anim_del(NULL, NULL);

  lv_timer_del(meter2_timer);
  meter2_timer = NULL;

  lv_obj_clean(lv_scr_act());

  lv_style_reset(&style_text_muted);
  lv_style_reset(&style_title);
  lv_style_reset(&style_icon);
  lv_style_reset(&style_bullet);
}


/**********************
*   STATIC FUNCTIONS
**********************/

static void Onboard_create(lv_obj_t * parent)
{

  /*Create a panel*/
  lv_obj_t * panel1 = lv_obj_create(parent);
  lv_obj_set_height(panel1, LV_SIZE_CONTENT);

  lv_obj_t * panel1_title = lv_label_create(panel1);
  lv_label_set_text(panel1_title, "Onboard parameter");
  lv_obj_add_style(panel1_title, &style_title, 0);

  lv_obj_t * SD_label = lv_label_create(panel1);
  lv_label_set_text(SD_label, "SD Card");
  lv_obj_add_style(SD_label, &style_text_muted, 0);

  SD_Size = lv_textarea_create(panel1);
  lv_textarea_set_one_line(SD_Size, true);
  lv_textarea_set_placeholder_text(SD_Size, "SD Size");
  lv_obj_add_event_cb(SD_Size, ta_event_cb, LV_EVENT_ALL, NULL);

  lv_obj_t * Flash_label = lv_label_create(panel1);
  lv_label_set_text(Flash_label, "Flash Size");
  lv_obj_add_style(Flash_label, &style_text_muted, 0);

  FlashSize = lv_textarea_create(panel1);
  lv_textarea_set_one_line(FlashSize, true);
  lv_textarea_set_placeholder_text(FlashSize, "Flash Size");
  lv_obj_add_event_cb(FlashSize, ta_event_cb, LV_EVENT_ALL, NULL);

  lv_obj_t * BAT_label = lv_label_create(panel1);
  lv_label_set_text(BAT_label, "Battery Voltage");
  lv_obj_add_style(BAT_label, &style_text_muted, 0);

  BAT_Volts = lv_textarea_create(panel1);
  lv_textarea_set_one_line(BAT_Volts, true);
  lv_textarea_set_placeholder_text(BAT_Volts, "BAT Volts");
  lv_obj_add_event_cb(BAT_Volts, ta_event_cb, LV_EVENT_ALL, NULL);

  lv_obj_t * angle_label = lv_label_create(panel1);
  lv_label_set_text(angle_label, "Angular deflection");
  lv_obj_add_style(angle_label, &style_text_muted, 0);

  Board_angle = lv_textarea_create(panel1);
  lv_textarea_set_one_line(Board_angle, true);
  lv_textarea_set_placeholder_text(Board_angle, "Board angle");
  lv_obj_add_event_cb(Board_angle, ta_event_cb, LV_EVENT_ALL, NULL);

  lv_obj_t * Time_label = lv_label_create(panel1);
  lv_label_set_text(Time_label, "RTC Time");
  lv_obj_add_style(Time_label, &style_text_muted, 0);

  RTC_Time = lv_textarea_create(panel1);
  lv_textarea_set_one_line(RTC_Time, true);
  lv_textarea_set_placeholder_text(RTC_Time, "Display time");
  lv_obj_add_event_cb(RTC_Time, ta_event_cb, LV_EVENT_ALL, NULL);


  lv_obj_t * Wireless_label = lv_label_create(panel1);
  lv_label_set_text(Wireless_label, "Wireless scan");
  lv_obj_add_style(Wireless_label, &style_text_muted, 0);

  Wireless_Scan = lv_textarea_create(panel1);
  lv_textarea_set_one_line(Wireless_Scan, true);
  lv_textarea_set_placeholder_text(Wireless_Scan, "Wireless number");
  lv_obj_add_event_cb(Wireless_Scan, ta_event_cb, LV_EVENT_ALL, NULL);

  lv_obj_t * Backlight_label = lv_label_create(panel1);
  lv_label_set_text(Backlight_label, "Backlight brightness");
  lv_obj_add_style(Backlight_label, &style_text_muted, 0);

  Backlight_slider = lv_slider_create(panel1);                                 
  lv_obj_add_flag(Backlight_slider, LV_OBJ_FLAG_CLICKABLE);    
  lv_obj_set_size(Backlight_slider, 200, 35);              
  lv_obj_set_style_radius(Backlight_slider, 3, LV_PART_KNOB);               // Adjust the value for more or less rounding                                            
  lv_obj_set_style_bg_opa(Backlight_slider, LV_OPA_TRANSP, LV_PART_KNOB);                               
  // lv_obj_set_style_pad_all(Backlight_slider, 0, LV_PART_KNOB);                                            
  lv_obj_set_style_bg_color(Backlight_slider, lv_color_hex(0xAAAAAA), LV_PART_KNOB);               
  lv_obj_set_style_bg_color(Backlight_slider, lv_color_hex(0xFFFFFF), LV_PART_INDICATOR);             
  lv_obj_set_style_outline_width(Backlight_slider, 2, LV_PART_INDICATOR);  
  lv_obj_set_style_outline_color(Backlight_slider, lv_color_hex(0xD3D3D3), LV_PART_INDICATOR);      
  lv_slider_set_range(Backlight_slider, 5, Backlight_MAX);              
  lv_slider_set_value(Backlight_slider, LCD_Backlight, LV_ANIM_ON);  
  lv_obj_add_event_cb(Backlight_slider, Backlight_adjustment_event_cb, LV_EVENT_VALUE_CHANGED, NULL);

  static lv_coord_t grid_main_col_dsc[] = {LV_GRID_FR(1), LV_GRID_TEMPLATE_LAST};
  static lv_coord_t grid_main_row_dsc[] = {LV_GRID_CONTENT, LV_GRID_CONTENT, LV_GRID_CONTENT, LV_GRID_TEMPLATE_LAST};
  lv_obj_set_grid_dsc_array(parent, grid_main_col_dsc, grid_main_row_dsc);


  /*Create the top panel*/
  static lv_coord_t grid_1_col_dsc[] = {LV_GRID_CONTENT, LV_GRID_FR(1), LV_GRID_TEMPLATE_LAST};
  static lv_coord_t grid_1_row_dsc[] = {LV_GRID_CONTENT, /*Avatar*/
                                        LV_GRID_CONTENT, /*Name*/
                                        LV_GRID_CONTENT, /*Description*/
                                        LV_GRID_CONTENT, /*Email*/
                                        LV_GRID_CONTENT, /*Phone number*/
                                        LV_GRID_CONTENT, /*Button1*/
                                        LV_GRID_CONTENT, /*Button2*/
                                        LV_GRID_TEMPLATE_LAST
                                        };

  lv_obj_set_grid_dsc_array(panel1, grid_1_col_dsc, grid_1_row_dsc);


  /*Create the top panel*/
  static lv_coord_t grid_2_col_dsc[] = {LV_GRID_FR(1), LV_GRID_FR(5), LV_GRID_FR(1), LV_GRID_TEMPLATE_LAST};
  static lv_coord_t grid_2_row_dsc[] = {
    LV_GRID_CONTENT,  /*Title*/
    5,                /*Separator*/
    LV_GRID_CONTENT,  /*Box title*/
    40,               /*Box*/
    LV_GRID_CONTENT,  /*Box title*/
    40,               /*Box*/
    LV_GRID_CONTENT,  /*Box title*/
    40,               /*Box*/
    LV_GRID_CONTENT,  /*Box title*/
    40,               /*Box*/
    LV_GRID_CONTENT,  /*Box title*/
    40,               /*Box*/
    LV_GRID_CONTENT,  /*Box title*/
    40,               /*Box*/
    LV_GRID_CONTENT,  /*Box title*/
    40,               /*Box*/
    LV_GRID_TEMPLATE_LAST               
  };

  lv_obj_set_grid_cell(panel1, LV_GRID_ALIGN_STRETCH, 0, 1, LV_GRID_ALIGN_START, 0, 1);
  lv_obj_set_grid_dsc_array(panel1, grid_2_col_dsc, grid_2_row_dsc);
  lv_obj_set_grid_cell(panel1_title, LV_GRID_ALIGN_START, 1, 1, LV_GRID_ALIGN_CENTER, 0, 1);
  lv_obj_set_grid_cell(SD_label, LV_GRID_ALIGN_START, 1, 1, LV_GRID_ALIGN_START, 2, 1);
  lv_obj_set_grid_cell(SD_Size, LV_GRID_ALIGN_STRETCH, 1, 1, LV_GRID_ALIGN_CENTER, 3, 1);
  lv_obj_set_grid_cell(Flash_label, LV_GRID_ALIGN_START, 1, 1, LV_GRID_ALIGN_START, 4, 1);
  lv_obj_set_grid_cell(FlashSize, LV_GRID_ALIGN_STRETCH, 1, 1, LV_GRID_ALIGN_CENTER, 5, 1);
  lv_obj_set_grid_cell(BAT_label, LV_GRID_ALIGN_START, 1, 1, LV_GRID_ALIGN_START, 6, 1);
  lv_obj_set_grid_cell(BAT_Volts, LV_GRID_ALIGN_STRETCH, 1, 1, LV_GRID_ALIGN_CENTER, 7, 1);
  lv_obj_set_grid_cell(angle_label, LV_GRID_ALIGN_START, 1, 1, LV_GRID_ALIGN_START, 8, 1);
  lv_obj_set_grid_cell(Board_angle, LV_GRID_ALIGN_STRETCH, 1, 1, LV_GRID_ALIGN_CENTER, 9, 1);
  lv_obj_set_grid_cell(Time_label, LV_GRID_ALIGN_START, 1, 1, LV_GRID_ALIGN_START, 10, 1);
  lv_obj_set_grid_cell(RTC_Time, LV_GRID_ALIGN_STRETCH, 1, 1, LV_GRID_ALIGN_CENTER, 11, 1);
  lv_obj_set_grid_cell(Wireless_label, LV_GRID_ALIGN_START, 1, 1, LV_GRID_ALIGN_START, 12, 1);
  lv_obj_set_grid_cell(Wireless_Scan, LV_GRID_ALIGN_STRETCH, 1, 1, LV_GRID_ALIGN_CENTER, 13, 1);
  lv_obj_set_grid_cell(Backlight_label, LV_GRID_ALIGN_START, 1, 1, LV_GRID_ALIGN_START, 14, 1);
  lv_obj_set_grid_cell(Backlight_slider, LV_GRID_ALIGN_STRETCH, 1, 1, LV_GRID_ALIGN_CENTER, 15, 1);

  auto_step_timer = lv_timer_create(example1_increase_lvgl_tick, 100, NULL);
}

void example1_increase_lvgl_tick(lv_timer_t * t)
{
  char buf[100]; 
  
  snprintf(buf, sizeof(buf), "%ld MB\r\n", SDCard_Size);
  lv_textarea_set_placeholder_text(SD_Size, buf);
  snprintf(buf, sizeof(buf), "%ld MB\r\n", Flash_Size);
  lv_textarea_set_placeholder_text(FlashSize, buf);
  snprintf(buf, sizeof(buf), "%.2f V\r\n", BAT_analogVolts);
  lv_textarea_set_placeholder_text(BAT_Volts, buf);
  snprintf(buf, sizeof(buf), "X:%.2f  Y:%.2f  Z:%.2f\r\n", Accel.x, Accel.y, Accel.z);
  lv_textarea_set_placeholder_text(Board_angle, buf);
  snprintf(buf, sizeof(buf), "%d.%d.%d   %d:%d:%d\r\n",datetime.year,datetime.month,datetime.day,datetime.hour,datetime.minute,datetime.second);
  lv_textarea_set_placeholder_text(RTC_Time, buf);
  if(Scan_finish)
    // snprintf(buf, sizeof(buf), "WIFI: %d    BLE: %d    ..Scan Finish.\r\n",WIFI_NUM,BLE_NUM);
    snprintf(buf, sizeof(buf), "WIFI: %d     ..Scan Finish.\r\n",WIFI_NUM);
  else
    snprintf(buf, sizeof(buf), "WIFI: %d  \r\n",WIFI_NUM);
    // snprintf(buf, sizeof(buf), "WIFI: %d    BLE: %d\r\n",WIFI_NUM,BLE_NUM);
  lv_textarea_set_placeholder_text(Wireless_Scan, buf);
  lv_slider_set_value(Backlight_slider, LCD_Backlight, LV_ANIM_ON); 
  LVGL_Backlight_adjustment(LCD_Backlight);
}
static void Music_create(lv_obj_t * parent)
{
  original_screen_bg_color = lv_obj_get_style_bg_color(parent, 0);
  lv_obj_set_style_bg_color(parent, lv_color_hex(0x343247), 0);

  _lv_demo_music_main_create(parent);
}

void Backlight_adjustment_event_cb(lv_event_t * e) {
  uint8_t Backlight = lv_slider_get_value(lv_event_get_target(e));  
  if (Backlight <= Backlight_MAX)  {
    lv_slider_set_value(Backlight_slider, Backlight, LV_ANIM_ON); 
    LCD_Backlight = Backlight;
    LVGL_Backlight_adjustment(Backlight);
  }
  else
    printf("Volume out of range: %d\n", Backlight);

}


static void ta_event_cb(lv_event_t * e)
{
}

void LVGL_Backlight_adjustment(uint8_t Backlight) {
  Set_Backlight(Backlight);                                 
}




