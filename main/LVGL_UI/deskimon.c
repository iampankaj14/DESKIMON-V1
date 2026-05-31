#include "deskimon.h"
#include "../QMI8658/QMI8658.h"
#include <stdlib.h> // for rand()

// ==========================================
// 1. STATE & VARIABLES
// ==========================================
typedef enum {
    EYE_STATE_BOOT = 0,
    EYE_STATE_NORMAL,
    EYE_STATE_BORED,
    EYE_STATE_HAPPY,
    EYE_STATE_ANGRY,
    EYE_STATE_SLEEP
} eye_state_t;

static eye_state_t current_state = EYE_STATE_BOOT;

// UI Objects
static lv_obj_t * eye_l;
static lv_obj_t * eye_r;
static lv_obj_t * mask_moon_l;
static lv_obj_t * mask_moon_r;
static lv_obj_t * mask_top_l;
static lv_obj_t * mask_top_r;

// Timers and State Tracking
static lv_timer_t * logic_timer = NULL;
static uint32_t state_time = 0;
static uint32_t idle_time = 0;
static uint32_t next_look_time = 3000;

// Sensor Tracking
static float last_accel_x = 0;
static float last_accel_y = 0;
static float last_accel_z = 0;

static int tap_count = 0;
static uint32_t last_tap_time = 0;

// ==========================================
// 2. ANIMATION HELPERS & FACES
// ==========================================

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
            anim_property(mask_top_l, set_translate_y_cb, lv_obj_get_style_translate_y(mask_top_l, 0), -30, 500);
            anim_property(mask_top_r, set_translate_y_cb, lv_obj_get_style_translate_y(mask_top_r, 0), -30, 500);
            break;
            
        case EYE_STATE_HAPPY:
            // Happy: Crescent moon via round mask.
            animate_eye_base(eye_l, 100, 165, LV_RADIUS_CIRCLE, 0, 0, 0, 400);
            animate_eye_base(eye_r, 100, 165, LV_RADIUS_CIRCLE, 0, 0, 0, 400);
            hide_masks(400);
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

// ==========================================
// 3. SENSOR LOGIC & TRIGGERS
// ==========================================

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
            animate_eye_base(eye_l, 100, 165, LV_RADIUS_CIRCLE, 0, 50, 0, 600);
            animate_eye_base(eye_r, 100, 165, LV_RADIUS_CIRCLE, 0, 50, 0, 600);
        } else if (state_time == 5000) {
            animate_eye_base(eye_l, 100, 165, LV_RADIUS_CIRCLE, 0, -50, 0, 800);
            animate_eye_base(eye_r, 100, 165, LV_RADIUS_CIRCLE, 0, -50, 0, 800);
        } else if (state_time == 7000) {
            animate_eye_base(eye_l, 100, 165, LV_RADIUS_CIRCLE, 0, 0, 0, 500);
            animate_eye_base(eye_r, 100, 165, LV_RADIUS_CIRCLE, 0, 0, 0, 500);
        } else if (state_time == 8000) {
            set_eyes_state(EYE_STATE_BORED);
        }
    } 
    else if (current_state == EYE_STATE_NORMAL) {
        if (idle_time > 10000) {
            set_eyes_state(EYE_STATE_SLEEP);
        } else {
            if (state_time >= next_look_time) {
                int32_t rx = (rand() % 100) - 50;
                int32_t ry = (rand() % 60) - 30;
                uint32_t speed = (rand() % 400) + 200;
                
                animate_eye_base(eye_l, 100, 165, LV_RADIUS_CIRCLE, 0, rx, ry, speed);
                animate_eye_base(eye_r, 100, 165, LV_RADIUS_CIRCLE, 0, rx, ry, speed);
                
                next_look_time = state_time + speed + (rand() % 3000) + 1000;
            }
        }
    }
    else if (current_state == EYE_STATE_HAPPY) {
        if (state_time > 3000) {
            set_eyes_state(EYE_STATE_NORMAL);
        }
    }
    else if (current_state == EYE_STATE_ANGRY) {
        if (state_time > 6000) { 
            set_eyes_state(EYE_STATE_NORMAL);
        }
    }
}

static void screen_event_cb(lv_event_t * e) {
    lv_event_code_t code = lv_event_get_code(e);
    if (code == LV_EVENT_PRESSED) {
        idle_time = 0;
        
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
        
        if (tap_count >= 3) { 
            set_eyes_state(EYE_STATE_ANGRY);
        } else if (tap_count == 1) {
            if (current_state != EYE_STATE_BOOT && current_state != EYE_STATE_ANGRY) {
                set_eyes_state(EYE_STATE_HAPPY);
            }
        }
    }
}

// ==========================================
// 4. MAIN ENTRY POINT (UI SETUP)
// ==========================================

static void create_eye_masks(lv_obj_t * eye, lv_obj_t ** top_mask, lv_obj_t ** moon_mask) {
    *top_mask = lv_obj_create(eye);
    lv_obj_set_size(*top_mask, 110, 120); 
    lv_obj_set_style_bg_color(*top_mask, lv_color_black(), 0);
    lv_obj_set_style_border_width(*top_mask, 0, 0);
    lv_obj_set_style_radius(*top_mask, 0, 0);
    lv_obj_align(*top_mask, LV_ALIGN_TOP_MID, 0, 0);
    lv_obj_set_style_translate_y(*top_mask, -300, 0);
    lv_obj_clear_flag(*top_mask, LV_OBJ_FLAG_SCROLLABLE);

    *moon_mask = lv_obj_create(eye);
    lv_obj_set_size(*moon_mask, 100, 165);
    lv_obj_set_style_bg_color(*moon_mask, lv_color_black(), 0);
    lv_obj_set_style_border_width(*moon_mask, 0, 0);
    lv_obj_set_style_radius(*moon_mask, LV_RADIUS_CIRCLE, 0);
    lv_obj_align(*moon_mask, LV_ALIGN_CENTER, 0, 0);
    lv_obj_set_style_translate_y(*moon_mask, -300, 0);
    lv_obj_clear_flag(*moon_mask, LV_OBJ_FLAG_SCROLLABLE);
}

void Deskimon_Start(void)
{
    lv_obj_t * scr = lv_scr_act();
    lv_obj_add_event_cb(scr, screen_event_cb, LV_EVENT_ALL, NULL);

    lv_obj_set_style_bg_color(scr, lv_color_black(), 0);
    lv_obj_set_style_bg_opa(scr, LV_OPA_COVER, 0);

    eye_l = lv_obj_create(scr);
    lv_obj_set_size(eye_l, 100, 165);
    lv_obj_set_style_radius(eye_l, LV_RADIUS_CIRCLE, 0);
    lv_obj_set_style_bg_color(eye_l, lv_color_hex(0x00FFFF), 0); 
    lv_obj_set_style_bg_opa(eye_l, LV_OPA_COVER, 0);
    lv_obj_set_style_border_width(eye_l, 0, 0);
    lv_obj_clear_flag(eye_l, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_align(eye_l, LV_ALIGN_CENTER, -60, 0);
    
    create_eye_masks(eye_l, &mask_top_l, &mask_moon_l);

    eye_r = lv_obj_create(scr);
    lv_obj_set_size(eye_r, 100, 165);
    lv_obj_set_style_radius(eye_r, LV_RADIUS_CIRCLE, 0);
    lv_obj_set_style_bg_color(eye_r, lv_color_hex(0x00FFFF), 0); 
    lv_obj_set_style_bg_opa(eye_r, LV_OPA_COVER, 0);
    lv_obj_set_style_border_width(eye_r, 0, 0);
    lv_obj_clear_flag(eye_r, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_align(eye_r, LV_ALIGN_CENTER, 60, 0);
    
    create_eye_masks(eye_r, &mask_top_r, &mask_moon_r);

    // Master logic timer (10Hz)
    logic_timer = lv_timer_create(logic_timer_cb, 100, NULL);
}
