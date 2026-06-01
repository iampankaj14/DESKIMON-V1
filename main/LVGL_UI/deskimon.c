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
    EYE_STATE_SLEEP,
    EYE_STATE_BLUSH,
    EYE_STATE_BORING,
    EYE_STATE_CHILL,
    EYE_STATE_CRY,
    EYE_STATE_CRYING_MOUTH
} eye_state_t;

static eye_state_t current_state = EYE_STATE_BOOT;

// UI Objects
static lv_obj_t * eye_l;
static lv_obj_t * eye_r;
static lv_obj_t * mask_moon_l;
static lv_obj_t * mask_moon_r;
static lv_obj_t * mask_top_l;
static lv_obj_t * mask_top_r;

// New Phase 1 UI Objects
static lv_obj_t * mouth_arc_l;
static lv_obj_t * mouth_arc_r;
static lv_obj_t * mouth_yawn;
static lv_obj_t * tear_l;
static lv_obj_t * tear_r;

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
    anim_property(mask_top_l, set_translate_y_cb, lv_obj_get_style_translate_y(mask_top_l, 0), -400, time);
    anim_property(mask_top_r, set_translate_y_cb, lv_obj_get_style_translate_y(mask_top_r, 0), -400, time);
    anim_property(mask_moon_l, set_translate_y_cb, lv_obj_get_style_translate_y(mask_moon_l, 0), -400, time);
    anim_property(mask_moon_r, set_translate_y_cb, lv_obj_get_style_translate_y(mask_moon_r, 0), -400, time);
}

static void hide_phase1_objects(uint32_t time) {
    anim_property(mouth_arc_l, set_translate_y_cb, lv_obj_get_style_translate_y(mouth_arc_l, 0), 400, time);
    anim_property(mouth_arc_r, set_translate_y_cb, lv_obj_get_style_translate_y(mouth_arc_r, 0), 400, time);
    
    anim_property(mouth_yawn, set_width_cb, lv_obj_get_width(mouth_yawn), 0, time);
    anim_property(mouth_yawn, set_height_cb, lv_obj_get_height(mouth_yawn), 0, time);
    anim_property(mouth_yawn, set_translate_y_cb, lv_obj_get_style_translate_y(mouth_yawn, 0), 400, time);
    
    anim_property(tear_l, set_translate_y_cb, lv_obj_get_style_translate_y(tear_l, 0), 400, time);
    anim_property(tear_r, set_translate_y_cb, lv_obj_get_style_translate_y(tear_r, 0), 400, time);
}

static void set_eyes_state(eye_state_t new_state) {
    if (current_state == new_state) return;
    current_state = new_state;
    state_time = 0;
    
    // Default styles for eyes
    lv_obj_set_style_bg_color(eye_l, lv_color_hex(0x00FFFF), 0);
    lv_obj_set_style_bg_color(eye_r, lv_color_hex(0x00FFFF), 0);
    lv_obj_set_style_bg_opa(eye_l, LV_OPA_COVER, 0);
    lv_obj_set_style_bg_opa(eye_r, LV_OPA_COVER, 0);
    
    switch (new_state) {
        case EYE_STATE_NORMAL:
            animate_eye_base(eye_l, 100, 165, LV_RADIUS_CIRCLE, 0, 0, 0, 400);
            animate_eye_base(eye_r, 100, 165, LV_RADIUS_CIRCLE, 0, 0, 0, 400);
            hide_masks(400);
            hide_phase1_objects(400);
            next_look_time = 1000;
            break;
            
        case EYE_STATE_BORED:
            animate_eye_base(eye_l, 100, 165, LV_RADIUS_CIRCLE, 0, 0, 0, 500);
            animate_eye_base(eye_r, 100, 165, LV_RADIUS_CIRCLE, 0, 0, 0, 500);
            hide_masks(500);
            hide_phase1_objects(500);
            anim_property(mask_top_l, set_translate_y_cb, lv_obj_get_style_translate_y(mask_top_l, 0), -30, 500);
            anim_property(mask_top_r, set_translate_y_cb, lv_obj_get_style_translate_y(mask_top_r, 0), -30, 500);
            break;
            
        case EYE_STATE_HAPPY:
            animate_eye_base(eye_l, 100, 165, LV_RADIUS_CIRCLE, 0, 0, 0, 400);
            animate_eye_base(eye_r, 100, 165, LV_RADIUS_CIRCLE, 0, 0, 0, 400);
            hide_masks(400);
            hide_phase1_objects(400);
            anim_property(mask_moon_l, set_translate_y_cb, lv_obj_get_style_translate_y(mask_moon_l, 0), 40, 400);
            anim_property(mask_moon_r, set_translate_y_cb, lv_obj_get_style_translate_y(mask_moon_r, 0), 40, 400);
            break;
            
        case EYE_STATE_ANGRY:
            lv_obj_set_style_bg_color(eye_l, lv_color_hex(0xFF0000), 0);
            lv_obj_set_style_bg_color(eye_r, lv_color_hex(0xFF0000), 0);
            animate_eye_base(eye_l, 100, 165, LV_RADIUS_CIRCLE, 0, 0, 0, 300); 
            animate_eye_base(eye_r, 100, 165, LV_RADIUS_CIRCLE, 0, 0, 0, 300);
            hide_masks(300);
            hide_phase1_objects(300);
            anim_property(mask_top_l, set_translate_y_cb, lv_obj_get_style_translate_y(mask_top_l, 0), -30, 300);
            anim_property(mask_top_r, set_translate_y_cb, lv_obj_get_style_translate_y(mask_top_r, 0), -30, 300);
            break;
            
        case EYE_STATE_SLEEP:
            lv_obj_set_style_bg_color(eye_l, lv_color_hex(0x005555), 0);
            lv_obj_set_style_bg_color(eye_r, lv_color_hex(0x005555), 0);
            animate_eye_base(eye_l, 90, 25, LV_RADIUS_CIRCLE, 0, 0, 40, 800); 
            animate_eye_base(eye_r, 90, 25, LV_RADIUS_CIRCLE, 0, 0, 40, 800);
            hide_masks(500);
            hide_phase1_objects(500);
            break;
            
        case EYE_STATE_BLUSH:
            // Blush: Same eyes as happy (moon masks)
            animate_eye_base(eye_l, 100, 165, LV_RADIUS_CIRCLE, 0, 0, 0, 300);
            animate_eye_base(eye_r, 100, 165, LV_RADIUS_CIRCLE, 0, 0, 0, 300);
            hide_masks(300);
            hide_phase1_objects(300);
            // Show Happy masks
            anim_property(mask_moon_l, set_translate_y_cb, lv_obj_get_style_translate_y(mask_moon_l, 0), 40, 300);
            anim_property(mask_moon_r, set_translate_y_cb, lv_obj_get_style_translate_y(mask_moon_r, 0), 40, 300);
            // Show "W" Mouth
            anim_property(mouth_arc_l, set_translate_y_cb, lv_obj_get_style_translate_y(mouth_arc_l, 0), 0, 300);
            anim_property(mouth_arc_r, set_translate_y_cb, lv_obj_get_style_translate_y(mouth_arc_r, 0), 0, 300);
            break;

        case EYE_STATE_BORING:
            animate_eye_base(eye_l, 100, 165, LV_RADIUS_CIRCLE, 0, 0, -30, 500); // Eyes slightly upward
            animate_eye_base(eye_r, 100, 165, LV_RADIUS_CIRCLE, 0, 0, -30, 500);
            hide_masks(500);
            hide_phase1_objects(500);
            anim_property(mask_top_l, set_translate_y_cb, lv_obj_get_style_translate_y(mask_top_l, 0), -30, 500); // Cut aggressively
            anim_property(mask_top_r, set_translate_y_cb, lv_obj_get_style_translate_y(mask_top_r, 0), -30, 500);
            // Yawn mouth
            anim_property(mouth_yawn, set_translate_y_cb, lv_obj_get_style_translate_y(mouth_yawn, 0), 50, 500);
            anim_property(mouth_yawn, set_width_cb, 0, 50, 500);
            anim_property(mouth_yawn, set_height_cb, 0, 70, 500);
            break;

        case EYE_STATE_CHILL:
            animate_eye_base(eye_l, 100, 165, LV_RADIUS_CIRCLE, 0, 0, -40, 400); // Move eyes much higher
            animate_eye_base(eye_r, 100, 165, LV_RADIUS_CIRCLE, 0, 0, -40, 400);
            hide_masks(400);
            hide_phase1_objects(400);
            anim_property(mask_top_l, set_translate_y_cb, lv_obj_get_style_translate_y(mask_top_l, 0), -30, 400);
            anim_property(mask_top_r, set_translate_y_cb, lv_obj_get_style_translate_y(mask_top_r, 0), -30, 400);
            // "W" Mouth
            anim_property(mouth_arc_l, set_translate_y_cb, lv_obj_get_style_translate_y(mouth_arc_l, 0), 0, 400);
            anim_property(mouth_arc_r, set_translate_y_cb, lv_obj_get_style_translate_y(mouth_arc_r, 0), 0, 400);
            break;

        case EYE_STATE_CRY:
            animate_eye_base(eye_l, 100, 15, LV_RADIUS_CIRCLE, 0, 0, -20, 300); // Thin horizontal line
            animate_eye_base(eye_r, 100, 15, LV_RADIUS_CIRCLE, 0, 0, -20, 300);
            hide_masks(300);
            hide_phase1_objects(300);
            // Show Tears touching the eyes
            anim_property(tear_l, set_translate_y_cb, lv_obj_get_style_translate_y(tear_l, 0), -22, 300);
            anim_property(tear_r, set_translate_y_cb, lv_obj_get_style_translate_y(tear_r, 0), -22, 300);
            break;

        case EYE_STATE_CRYING_MOUTH:
            animate_eye_base(eye_l, 100, 15, LV_RADIUS_CIRCLE, 0, 0, -20, 300);
            animate_eye_base(eye_r, 100, 15, LV_RADIUS_CIRCLE, 0, 0, -20, 300);
            hide_masks(300);
            hide_phase1_objects(300);
            anim_property(tear_l, set_translate_y_cb, lv_obj_get_style_translate_y(tear_l, 0), -22, 300);
            anim_property(tear_r, set_translate_y_cb, lv_obj_get_style_translate_y(tear_r, 0), -22, 300);
            // Show Yawn mouth
            anim_property(mouth_yawn, set_translate_y_cb, lv_obj_get_style_translate_y(mouth_yawn, 0), 50, 300);
            anim_property(mouth_yawn, set_width_cb, 0, 50, 300);
            anim_property(mouth_yawn, set_height_cb, 0, 70, 300);
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

    // Tilt Detection (For CRY)
    // Assuming Accel.y > 0.6 means board is tilted upwards strongly. Adjust based on real board orientation.
    bool tilted_up = (Accel.y > 0.6f);
    bool shaking = (move_amt > 1.5f);

    if (tilted_up) {
        idle_time = 0;
        if (shaking) {
            set_eyes_state(EYE_STATE_CRYING_MOUTH);
        } else if (current_state != EYE_STATE_CRY && current_state != EYE_STATE_CRYING_MOUTH) {
            set_eyes_state(EYE_STATE_CRY);
        }
    } else {
        // If not tilted, handle normal movement wakeups
        if (move_amt > 0.05f) {
            idle_time = 0;
            if (current_state == EYE_STATE_BORED || current_state == EYE_STATE_SLEEP) {
                set_eyes_state(EYE_STATE_NORMAL);
            }
        }
        
        // Violent shake when not tilted -> ANGRY
        if (shaking && !tilted_up) {
            idle_time = 0;
            if (current_state != EYE_STATE_ANGRY && current_state != EYE_STATE_CRYING_MOUTH) {
                set_eyes_state(EYE_STATE_ANGRY);
            }
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
            // Boot sequence transitions to NORMAL as requested for Phase 1
            set_eyes_state(EYE_STATE_NORMAL);
        }
    } 
    else if (current_state == EYE_STATE_NORMAL) {
        if (idle_time > 7000) { // 7 seconds no interaction
            set_eyes_state(EYE_STATE_BORING);
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
    else if (current_state == EYE_STATE_BORING) {
        if (state_time > 4500) { // Remain for 4-5 seconds
            set_eyes_state(EYE_STATE_BORED);
        }
    }
    else if (current_state == EYE_STATE_BORED) {
        if (idle_time > 20000) { // Eventual sleep after long boredom
            set_eyes_state(EYE_STATE_SLEEP);
        }
    }
    else if (current_state == EYE_STATE_HAPPY || current_state == EYE_STATE_BLUSH || current_state == EYE_STATE_CRY) {
        // Timed transitions back to normal
        // CRY stays if tilted, but if we reached here, tilted_up is false.
        if (state_time > 3500) {
            set_eyes_state(EYE_STATE_NORMAL);
        }
    }
    else if (current_state == EYE_STATE_CHILL) {
        if (state_time > 2500) {
            set_eyes_state(EYE_STATE_NORMAL);
        }
    }
    else if (current_state == EYE_STATE_ANGRY) {
        if (state_time > 6000) { 
            set_eyes_state(EYE_STATE_NORMAL);
        }
    }
    else if (current_state == EYE_STATE_CRYING_MOUTH) {
        if (state_time > 4500) {
            if (!shaking && !tilted_up) {
                set_eyes_state(EYE_STATE_NORMAL);
            } else if (!shaking && tilted_up) {
                set_eyes_state(EYE_STATE_CRY);
            }
        }
    }
}

static void screen_event_cb(lv_event_t * e) {
    lv_event_code_t code = lv_event_get_code(e);
    
    if (code == LV_EVENT_GESTURE) {
        lv_dir_t dir = lv_indev_get_gesture_dir(lv_indev_get_act());
        if (dir == LV_DIR_LEFT || dir == LV_DIR_RIGHT) {
            idle_time = 0;
            set_eyes_state(EYE_STATE_BLUSH);
        }
        return;
    }

    if (code == LV_EVENT_PRESSED) {
        idle_time = 0;
        
        if (current_state == EYE_STATE_BORED) {
            set_eyes_state(EYE_STATE_CHILL);
            return;
        }

        if (current_state == EYE_STATE_SLEEP) {
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
            if (current_state != EYE_STATE_BOOT && current_state != EYE_STATE_ANGRY && current_state != EYE_STATE_BLUSH) {
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
    lv_obj_set_style_translate_y(*top_mask, -400, 0);
    lv_obj_clear_flag(*top_mask, LV_OBJ_FLAG_SCROLLABLE);

    *moon_mask = lv_obj_create(eye);
    lv_obj_set_size(*moon_mask, 100, 165);
    lv_obj_set_style_bg_color(*moon_mask, lv_color_black(), 0);
    lv_obj_set_style_border_width(*moon_mask, 0, 0);
    lv_obj_set_style_radius(*moon_mask, LV_RADIUS_CIRCLE, 0);
    lv_obj_align(*moon_mask, LV_ALIGN_CENTER, 0, 0);
    lv_obj_set_style_translate_y(*moon_mask, -400, 0);
    lv_obj_clear_flag(*moon_mask, LV_OBJ_FLAG_SCROLLABLE);
}

void Deskimon_Start(void)
{
    lv_obj_t * scr = lv_scr_act();
    lv_obj_add_event_cb(scr, screen_event_cb, LV_EVENT_ALL, NULL);
    lv_obj_clear_flag(scr, LV_OBJ_FLAG_SCROLLABLE);

    lv_obj_set_style_bg_color(scr, lv_color_black(), 0);
    lv_obj_set_style_bg_opa(scr, LV_OPA_COVER, 0);

    // -- Base Eyes --
    eye_l = lv_obj_create(scr);
    lv_obj_set_size(eye_l, 100, 165);
    lv_obj_set_style_radius(eye_l, LV_RADIUS_CIRCLE, 0);
    lv_obj_set_style_bg_color(eye_l, lv_color_hex(0x00FFFF), 0); 
    lv_obj_set_style_border_width(eye_l, 0, 0);
    lv_obj_clear_flag(eye_l, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_align(eye_l, LV_ALIGN_CENTER, -60, 0);
    create_eye_masks(eye_l, &mask_top_l, &mask_moon_l);

    eye_r = lv_obj_create(scr);
    lv_obj_set_size(eye_r, 100, 165);
    lv_obj_set_style_radius(eye_r, LV_RADIUS_CIRCLE, 0);
    lv_obj_set_style_bg_color(eye_r, lv_color_hex(0x00FFFF), 0); 
    lv_obj_set_style_border_width(eye_r, 0, 0);
    lv_obj_clear_flag(eye_r, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_align(eye_r, LV_ALIGN_CENTER, 60, 0);
    create_eye_masks(eye_r, &mask_top_r, &mask_moon_r);

    // -- Phase 1 Objects --

    // "W" Mouth (For BLUSH, CHILL)
    mouth_arc_l = lv_arc_create(scr);
    lv_arc_set_bg_angles(mouth_arc_l, 0, 180); // Bottom half circle
    lv_obj_set_size(mouth_arc_l, 40, 40);
    lv_obj_remove_style(mouth_arc_l, NULL, LV_PART_INDICATOR);
    lv_obj_remove_style(mouth_arc_l, NULL, LV_PART_KNOB);
    lv_obj_set_style_arc_width(mouth_arc_l, 8, LV_PART_MAIN);
    lv_obj_set_style_arc_color(mouth_arc_l, lv_color_hex(0x00FFFF), LV_PART_MAIN);
    lv_obj_align(mouth_arc_l, LV_ALIGN_CENTER, -20, 60);
    lv_obj_set_style_translate_y(mouth_arc_l, 400, 0);

    mouth_arc_r = lv_arc_create(scr);
    lv_arc_set_bg_angles(mouth_arc_r, 0, 180); 
    lv_obj_set_size(mouth_arc_r, 40, 40);
    lv_obj_remove_style(mouth_arc_r, NULL, LV_PART_INDICATOR);
    lv_obj_remove_style(mouth_arc_r, NULL, LV_PART_KNOB);
    lv_obj_set_style_arc_width(mouth_arc_r, 8, LV_PART_MAIN);
    lv_obj_set_style_arc_color(mouth_arc_r, lv_color_hex(0x00FFFF), LV_PART_MAIN);
    lv_obj_align(mouth_arc_r, LV_ALIGN_CENTER, 20, 60);
    lv_obj_set_style_translate_y(mouth_arc_r, 400, 0);

    // Yawn Mouth (For BORING, CRYING_MOUTH)
    mouth_yawn = lv_obj_create(scr);
    lv_obj_set_size(mouth_yawn, 0, 0); // Scales up when animating
    lv_obj_set_style_radius(mouth_yawn, LV_RADIUS_CIRCLE, 0);
    lv_obj_set_style_bg_color(mouth_yawn, lv_color_hex(0x00FFFF), 0);
    lv_obj_set_style_border_width(mouth_yawn, 0, 0);
    lv_obj_align(mouth_yawn, LV_ALIGN_CENTER, 0, 50); // Will align center initially
    lv_obj_set_style_translate_y(mouth_yawn, 400, 0);
    
    // Tears (For CRY)
    tear_l = lv_obj_create(scr);
    lv_obj_set_size(tear_l, 20, 80);
    lv_obj_set_style_radius(tear_l, LV_RADIUS_CIRCLE, 0);
    lv_obj_set_style_bg_color(tear_l, lv_color_hex(0x00FFFF), 0);
    lv_obj_set_style_border_width(tear_l, 0, 0);
    lv_obj_align(tear_l, LV_ALIGN_CENTER, -60, 50);
    lv_obj_set_style_translate_y(tear_l, 400, 0);

    tear_r = lv_obj_create(scr);
    lv_obj_set_size(tear_r, 20, 80);
    lv_obj_set_style_radius(tear_r, LV_RADIUS_CIRCLE, 0);
    lv_obj_set_style_bg_color(tear_r, lv_color_hex(0x00FFFF), 0);
    lv_obj_set_style_border_width(tear_r, 0, 0);
    lv_obj_align(tear_r, LV_ALIGN_CENTER, 60, 50);
    lv_obj_set_style_translate_y(tear_r, 400, 0);


    // Master logic timer (10Hz)
    logic_timer = lv_timer_create(logic_timer_cb, 100, NULL);
}
