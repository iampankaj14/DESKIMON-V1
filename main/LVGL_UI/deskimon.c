#include "deskimon.h"
#include "../QMI8658/QMI8658.h"
#include <stdlib.h>

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
    EYE_STATE_CRYING_MOUTH,
    EYE_STATE_EYES_CLOSED,
    EYE_STATE_HAPPY_CRY,
    EYE_STATE_IGNORE,
    EYE_STATE_INSECURE,
    EYE_STATE_INTEREST,
    EYE_STATE_OOH,
    EYE_STATE_WTF,
    EYE_STATE_LAUGH,
    EYE_STATE_MAX
} eye_state_t;

static eye_state_t current_state = EYE_STATE_BOOT;

static uint32_t s_eye_color_hex = 0x00FFFF;
static volatile bool s_eye_color_pending = false;
static volatile eye_state_t s_pending_eye_state = EYE_STATE_MAX;
static volatile bool s_eye_state_pending = false;

// UI Objects
static lv_obj_t * eye_l;
static lv_obj_t * eye_r;
static lv_obj_t * mask_moon_l;
static lv_obj_t * mask_moon_r;
static lv_obj_t * mask_top_l;
static lv_obj_t * mask_top_r;

// Phase 1 & 2 UI Objects
static lv_obj_t * mouth_arc_l;
static lv_obj_t * mouth_arc_r;
static lv_obj_t * interest_mouth_l;
static lv_obj_t * interest_mouth_r;
static lv_obj_t * mouth_yawn;
static lv_obj_t * tear_l;
static lv_obj_t * tear_r;

static lv_obj_t * eye_closed_l;
static lv_obj_t * eye_closed_r;
static lv_obj_t * mouth_triangle;
static lv_obj_t * insecure_mouth;
static lv_obj_t * mouth_ooh;
static lv_obj_t * mouth_wtf;
static lv_obj_t * mouth_wtf_circle; // Dedicated morph circle for WTF face
static lv_obj_t * laugh_mouth;
static lv_obj_t * laugh_hemi_l;
static lv_obj_t * laugh_hemi_r;
static lv_obj_t * ignore_line_l;
static lv_obj_t * ignore_line_r;
static lv_obj_t * ignore_hemi_l;
static lv_obj_t * ignore_hemi_r;

static lv_obj_t * insecure_eye_l;
static lv_obj_t * insecure_eye_r;
static lv_obj_t * insec_cover_l;
static lv_obj_t * insec_cover_r;

static lv_timer_t * logic_timer = NULL;
static uint32_t state_time = 0;
static uint32_t idle_time = 0;
static uint32_t next_look_time = 3000;

static float last_accel_x = 0, last_accel_y = 0, last_accel_z = 0;
static int tap_count = 0;
static uint32_t last_tap_time = 0;

// ANIMATION HELPERS
static void set_width_cb(void * var, int32_t v) { lv_obj_set_width((lv_obj_t *)var, v); }
static void set_height_cb(void * var, int32_t v) { lv_obj_set_height((lv_obj_t *)var, v); }
static void set_angle_cb(void * var, int32_t v) { lv_obj_set_style_transform_angle((lv_obj_t *)var, v, 0); }
static void set_tx_cb(void * var, int32_t v) { lv_obj_set_style_translate_x((lv_obj_t *)var, v, 0); }
static void set_ty_cb(void * var, int32_t v) { lv_obj_set_style_translate_y((lv_obj_t *)var, v, 0); }
static void set_opa_cb(void * var, int32_t v) { lv_obj_set_style_opa((lv_obj_t *)var, v, 0); }

static void anim_prop(lv_obj_t * obj, lv_anim_exec_xcb_t cb, int32_t start, int32_t end, uint32_t time) {
    lv_anim_del(obj, cb);
    if (time == 0) {
        cb(obj, end);
        return;
    }
    lv_anim_t a;
    lv_anim_init(&a);
    lv_anim_set_var(&a, obj);
    lv_anim_set_values(&a, start, end);
    lv_anim_set_time(&a, time);
    lv_anim_set_exec_cb(&a, cb);
    lv_anim_set_path_cb(&a, lv_anim_path_ease_in_out);
    lv_anim_start(&a);
}

// EXACT MASKING ENGINE FOR INSECURE FACE
static void happy_mouth_mask_event_cb(lv_event_t * e) {
    lv_event_code_t code = lv_event_get_code(e);
    lv_obj_t * obj = lv_event_get_target(e);

    static lv_draw_mask_line_param_t m1;
    static lv_draw_mask_line_param_t m2;
    static int16_t id1 = -1;
    static int16_t id2 = -1;

    if (code == LV_EVENT_DRAW_MAIN_BEGIN) {
        lv_area_t coords;
        lv_obj_get_coords(obj, &coords);
        
        lv_draw_mask_line_points_init(&m1, coords.x1, coords.y1, coords.x1 + lv_area_get_width(&coords)/2, coords.y2, LV_DRAW_MASK_LINE_SIDE_RIGHT);
        id1 = lv_draw_mask_add(&m1, NULL);

        lv_draw_mask_line_points_init(&m2, coords.x2, coords.y1, coords.x1 + lv_area_get_width(&coords)/2, coords.y2, LV_DRAW_MASK_LINE_SIDE_LEFT);
        id2 = lv_draw_mask_add(&m2, NULL);
    }
    else if (code == LV_EVENT_DRAW_MAIN_END) {
        if (id1 >= 0) { lv_draw_mask_remove_id(id1); id1 = -1; }
        if (id2 >= 0) { lv_draw_mask_remove_id(id2); id2 = -1; }
    }
}

static void wtf_mouth_mask_event_cb(lv_event_t * e) {
    lv_event_code_t code = lv_event_get_code(e);
    lv_obj_t * obj = lv_event_get_target(e);

    static lv_draw_mask_line_param_t m1;
    static lv_draw_mask_line_param_t m2;
    static int16_t id1 = -1;
    static int16_t id2 = -1;

    if (code == LV_EVENT_DRAW_MAIN_BEGIN) {
        lv_area_t coords;
        lv_obj_get_coords(obj, &coords);
        int32_t cx = coords.x1 + lv_area_get_width(&coords) / 2;
        
        lv_draw_mask_line_points_init(&m1, coords.x1, coords.y2, cx, coords.y1, LV_DRAW_MASK_LINE_SIDE_RIGHT);
        id1 = lv_draw_mask_add(&m1, NULL);

        lv_draw_mask_line_points_init(&m2, coords.x2, coords.y2, cx, coords.y1, LV_DRAW_MASK_LINE_SIDE_LEFT);
        id2 = lv_draw_mask_add(&m2, NULL);
    }
    else if (code == LV_EVENT_DRAW_MAIN_END) {
        if (id1 >= 0) { lv_draw_mask_remove_id(id1); id1 = -1; }
        if (id2 >= 0) { lv_draw_mask_remove_id(id2); id2 = -1; }
    }
}

static void eye_mask_event_cb(lv_event_t * e) {
    lv_event_code_t code = lv_event_get_code(e);
    lv_obj_t * obj = lv_event_get_target(e);
    int type = (intptr_t)lv_event_get_user_data(e); // 1 = insec_l, 2 = insec_r, 3 = ignore_l, 4 = ignore_r

    static lv_draw_mask_line_param_t m[5];
    static int16_t id[5] = {-1, -1, -1, -1, -1};

    if (code == LV_EVENT_DRAW_MAIN_BEGIN) {
        lv_area_t coords;
        lv_obj_get_coords(obj, &coords);
        int32_t cx = coords.x1 + lv_area_get_width(&coords) / 2;
        int32_t cy = coords.y1 + lv_area_get_height(&coords) / 2;

        int angle = 0;
        lv_coord_t line_y = cy - 10;
        if (type == 1) angle = 20;
        else if (type == 2) angle = 160;

        lv_draw_mask_line_angle_init(&m[type], cx, line_y, angle, LV_DRAW_MASK_LINE_SIDE_BOTTOM);
        id[type] = lv_draw_mask_add(&m[type], NULL);
    }
    else if (code == LV_EVENT_DRAW_MAIN_END) {
        if (id[type] >= 0) {
            lv_draw_mask_remove_id(id[type]);
            id[type] = -1;
        }
    }
}

static void animate_eye_base(lv_obj_t * eye, int32_t w, int32_t h, int32_t angle, int32_t tx, int32_t ty, uint32_t time) {
    anim_prop(eye, set_width_cb, lv_obj_get_width(eye), w, time);
    anim_prop(eye, set_height_cb, lv_obj_get_height(eye), h, time);
    anim_prop(eye, set_angle_cb, lv_obj_get_style_transform_angle(eye, 0), angle, time);
    anim_prop(eye, set_tx_cb, lv_obj_get_style_translate_x(eye, 0), tx, time);
    anim_prop(eye, set_ty_cb, lv_obj_get_style_translate_y(eye, 0), ty, time);
}

static void hide_masks(uint32_t time) {
    anim_prop(mask_top_l, set_ty_cb, lv_obj_get_style_translate_y(mask_top_l, 0), -400, time);
    anim_prop(mask_top_r, set_ty_cb, lv_obj_get_style_translate_y(mask_top_r, 0), -400, time);
    anim_prop(mask_moon_l, set_ty_cb, lv_obj_get_style_translate_y(mask_moon_l, 0), -400, time);
    anim_prop(mask_moon_r, set_ty_cb, lv_obj_get_style_translate_y(mask_moon_r, 0), -400, time);
}

static void fade_obj(lv_obj_t * obj, bool show, uint32_t time) {
    lv_anim_del(obj, set_opa_cb);
    int32_t start = lv_obj_get_style_opa(obj, 0);
    int32_t end = show ? 255 : 0;
    if(start != end) anim_prop(obj, set_opa_cb, start, end, time);
}

static void hide_all_accessories(uint32_t time) {
    fade_obj(mouth_arc_l, false, time);
    fade_obj(mouth_arc_r, false, time);
    fade_obj(interest_mouth_l, false, time);
    fade_obj(interest_mouth_r, false, time);
    fade_obj(tear_l, false, time);
    fade_obj(tear_r, false, time);
    fade_obj(eye_closed_l, false, time);
    fade_obj(eye_closed_r, false, time);
    fade_obj(mouth_triangle, false, time);
    fade_obj(insecure_mouth, false, time);
    fade_obj(insecure_eye_l, false, time);
    fade_obj(insecure_eye_r, false, time);
    fade_obj(mouth_ooh, false, time);
    fade_obj(mouth_wtf, false, time);
    fade_obj(mouth_wtf_circle, false, time);
    fade_obj(laugh_mouth, false, time);
    fade_obj(laugh_hemi_l, false, time);
    fade_obj(laugh_hemi_r, false, time);
    fade_obj(ignore_line_l, false, time);
    fade_obj(ignore_line_r, false, time);
    fade_obj(ignore_hemi_l, false, time);
    fade_obj(ignore_hemi_r, false, time);
    fade_obj(mouth_yawn, false, time);
    lv_anim_del(insec_cover_l, set_opa_cb);
    lv_obj_set_style_opa(insec_cover_l, 0, 0);
    lv_anim_del(insec_cover_r, set_opa_cb);
    lv_obj_set_style_opa(insec_cover_r, 0, 0);
}

static void update_name_label(const char * name) {
    // Removed name label
}

static void set_eyes_state(eye_state_t new_state) {
    if (new_state == current_state) return;

    if (current_state == EYE_STATE_IGNORE) {
        fade_obj(eye_l, true, 300);
        fade_obj(eye_r, true, 300);
    }
    
    current_state = new_state;
    state_time = 0;
    
    lv_obj_set_style_bg_color(eye_l, lv_color_hex(s_eye_color_hex), 0);
    lv_obj_set_style_bg_color(eye_r, lv_color_hex(s_eye_color_hex), 0);
    
    // Hide base eyes ONLY if we are switching to dedicated eyes
    if (new_state == EYE_STATE_INSECURE || new_state == EYE_STATE_INTEREST || 
        new_state == EYE_STATE_IGNORE || new_state == EYE_STATE_EYES_CLOSED) {
        fade_obj(eye_l, false, 300);
        fade_obj(eye_r, false, 300);
    } else {
        fade_obj(eye_l, true, 300);
        fade_obj(eye_r, true, 300);
    }
    
    hide_masks(300);
    hide_all_accessories(300);
    
    switch (new_state) {
        case EYE_STATE_NORMAL:
            update_name_label("NORMAL");
            animate_eye_base(eye_l, 100, 165, 0, 0, 0, 400);
            animate_eye_base(eye_r, 100, 165, 0, 0, 0, 400);
            next_look_time = 1000;
            break;
            
        case EYE_STATE_BORED:
            update_name_label("BORED");
            animate_eye_base(eye_l, 130, 180, 0, 0, -40, 500);
            animate_eye_base(eye_r, 130, 180, 0, 0, -40, 500);
            anim_prop(mask_top_l, set_ty_cb, lv_obj_get_style_translate_y(mask_top_l, 0), -40, 500);
            anim_prop(mask_top_r, set_ty_cb, lv_obj_get_style_translate_y(mask_top_r, 0), -40, 500);
            break;
            
        case EYE_STATE_HAPPY:
            update_name_label("HAPPY");
            animate_eye_base(eye_l, 100, 165, 0, 0, 0, 400);
            animate_eye_base(eye_r, 100, 165, 0, 0, 0, 400);
            anim_prop(mask_moon_l, set_ty_cb, lv_obj_get_style_translate_y(mask_moon_l, 0), 40, 400);
            anim_prop(mask_moon_r, set_ty_cb, lv_obj_get_style_translate_y(mask_moon_r, 0), 40, 400);
            break;
            
        case EYE_STATE_ANGRY:
            update_name_label("ANGRY");
            lv_obj_set_style_bg_color(eye_l, lv_color_hex(0xFF0000), 0);
            lv_obj_set_style_bg_color(eye_r, lv_color_hex(0xFF0000), 0);
            animate_eye_base(eye_l, 130, 180, 0, 0, -40, 300); 
            animate_eye_base(eye_r, 130, 180, 0, 0, -40, 300);
            anim_prop(mask_top_l, set_ty_cb, lv_obj_get_style_translate_y(mask_top_l, 0), -40, 300);
            anim_prop(mask_top_r, set_ty_cb, lv_obj_get_style_translate_y(mask_top_r, 0), -40, 300);
            break;
            
        case EYE_STATE_SLEEP:
            update_name_label("SLEEP");
            lv_obj_set_style_bg_color(eye_l, lv_color_hex(0x005555), 0);
            lv_obj_set_style_bg_color(eye_r, lv_color_hex(0x005555), 0);
            animate_eye_base(eye_l, 90, 25, 0, 0, 40, 800); 
            animate_eye_base(eye_r, 90, 25, 0, 0, 40, 800);
            break;
            
        case EYE_STATE_BLUSH:
            update_name_label("BLUSH");
            animate_eye_base(eye_l, 100, 165, 0, 0, 0, 300);
            animate_eye_base(eye_r, 100, 165, 0, 0, 0, 300);
            anim_prop(mask_moon_l, set_ty_cb, lv_obj_get_style_translate_y(mask_moon_l, 0), 40, 300);
            anim_prop(mask_moon_r, set_ty_cb, lv_obj_get_style_translate_y(mask_moon_r, 0), 40, 300);
            fade_obj(mouth_arc_l, true, 300);
            fade_obj(mouth_arc_r, true, 300);
            break;

        case EYE_STATE_BORING:
            update_name_label("BORING");
            animate_eye_base(eye_l, 100, 165, 0, 0, -50, 500); // Fixed distance from mouth
            animate_eye_base(eye_r, 100, 165, 0, 0, -50, 500);
            anim_prop(mask_top_l, set_ty_cb, lv_obj_get_style_translate_y(mask_top_l, 0), -50, 500); 
            anim_prop(mask_top_r, set_ty_cb, lv_obj_get_style_translate_y(mask_top_r, 0), -50, 500);
            fade_obj(mouth_yawn, true, 500);
            break;

        case EYE_STATE_CHILL:
            update_name_label("CHILL");
            animate_eye_base(eye_l, 100, 165, 0, 0, -50, 400); // Fixed distance from mouth
            animate_eye_base(eye_r, 100, 165, 0, 0, -50, 400);
            anim_prop(mask_top_l, set_ty_cb, lv_obj_get_style_translate_y(mask_top_l, 0), -50, 400);
            anim_prop(mask_top_r, set_ty_cb, lv_obj_get_style_translate_y(mask_top_r, 0), -50, 400);
            fade_obj(mouth_arc_l, true, 400);
            fade_obj(mouth_arc_r, true, 400);
            break;

        case EYE_STATE_CRY:
            update_name_label("CRY");
            animate_eye_base(eye_l, 100, 15, 0, 0, -20, 300);
            animate_eye_base(eye_r, 100, 15, 0, 0, -20, 300);
            fade_obj(tear_l, true, 300);
            fade_obj(tear_r, true, 300);
            break;

        case EYE_STATE_CRYING_MOUTH:
            update_name_label("CRYING MOUTH");
            animate_eye_base(eye_l, 100, 15, 0, 0, -20, 300);
            animate_eye_base(eye_r, 100, 15, 0, 0, -20, 300);
            fade_obj(tear_l, true, 300);
            fade_obj(tear_r, true, 300);
            anim_prop(tear_l, set_height_cb, 0, 80, 500); // Render block
            anim_prop(tear_l, set_ty_cb, 0, 40, 500); // Render block
            anim_prop(tear_r, set_height_cb, 0, 80, 500); // Render block
            anim_prop(tear_r, set_ty_cb, 0, 40, 500); // Render block
            fade_obj(mouth_yawn, true, 300);
            break;

        case EYE_STATE_EYES_CLOSED:
            update_name_label("EYES CLOSED");
            fade_obj(eye_l, false, 300);
            fade_obj(eye_r, false, 300);
            animate_eye_base(eye_l, 20, 100, 0, 0, 0, 300); // Squash horizontally to resemble the closed lines
            animate_eye_base(eye_r, 20, 100, 0, 0, 0, 300);
            fade_obj(eye_closed_l, true, 300);
            fade_obj(eye_closed_r, true, 300);
            break;

        case EYE_STATE_HAPPY_CRY:
            update_name_label("HAPPY CRY");
            animate_eye_base(eye_l, 100, 15, 0, 0, -30, 300);
            animate_eye_base(eye_r, 100, 15, 0, 0, -30, 300);
            fade_obj(tear_l, true, 300);
            fade_obj(tear_r, true, 300);
            anim_prop(tear_l, set_height_cb, 0, 80, 500);
            anim_prop(tear_l, set_ty_cb, 0, 40, 500);
            anim_prop(tear_r, set_height_cb, 0, 80, 500);
            anim_prop(tear_r, set_ty_cb, 0, 40, 500);
            fade_obj(mouth_triangle, true, 300);
            break;

        case EYE_STATE_IGNORE:
            update_name_label("IGNORE");
            fade_obj(eye_l, false, 300);
            fade_obj(eye_r, false, 300);
            animate_eye_base(eye_l, 130, 20, 0, -15, 20, 300);
            animate_eye_base(eye_r, 130, 20, 0, 15, 20, 300);
            fade_obj(ignore_line_l, true, 300);
            fade_obj(ignore_line_r, true, 300);
            fade_obj(ignore_hemi_l, true, 300);
            fade_obj(ignore_hemi_r, true, 300);
            break;

        case EYE_STATE_INSECURE:
            update_name_label("INSECURE");
            fade_obj(eye_l, false, 300); // Fix for intersecting base eyes
            fade_obj(eye_r, false, 300);
            fade_obj(insecure_eye_l, true, 300);
            fade_obj(insecure_eye_r, true, 300);
            fade_obj(insecure_mouth, true, 300);
            fade_obj(insec_cover_l, true, 300);
            fade_obj(insec_cover_r, true, 300);
            break;

        case EYE_STATE_INTEREST:
            update_name_label("INTEREST");
            fade_obj(eye_l, false, 300); // Fix for intersecting base eyes
            fade_obj(eye_r, false, 300);
            fade_obj(insecure_eye_l, true, 300); // Identical to INSECURE
            fade_obj(insecure_eye_r, true, 300); // Identical to INSECURE
            fade_obj(interest_mouth_l, true, 300);
            fade_obj(interest_mouth_r, true, 300);
            fade_obj(insec_cover_l, true, 300);
            fade_obj(insec_cover_r, true, 300);
            break;

        case EYE_STATE_OOH:
            update_name_label("OOH");
            lv_obj_set_size(eye_l, 70, 90); // Start smaller (surprise pop)
            lv_obj_set_size(eye_r, 70, 90);
            animate_eye_base(eye_l, 105, 130, 0, 0, -10, 500); // Expanding to big egg eyes
            animate_eye_base(eye_r, 105, 130, 0, 0, -10, 500);
            
            lv_obj_set_size(mouth_ooh, 10, 5); // Start closed slit
            fade_obj(mouth_ooh, true, 300);
            anim_prop(mouth_ooh, set_width_cb, 10, 32, 500); // Smoothly expanding vocalization
            anim_prop(mouth_ooh, set_height_cb, 5, 32, 500);
            break;

        case EYE_STATE_WTF:
            update_name_label("WTF");
            
            // Animate flat eyes expanding outward & positioned even higher (ty = -45)
            lv_obj_set_size(eye_l, 20, 16); // Start short dash
            lv_obj_set_size(eye_r, 20, 16);
            animate_eye_base(eye_l, 100, 16, 0, 0, -45, 500); // laser expand & lift higher
            animate_eye_base(eye_r, 100, 16, 0, 0, -45, 500);
            
            // Morphing mouth: Solid cyan circle -> Triangle
            lv_obj_set_size(mouth_wtf_circle, 35, 35); // Start as solid circle
            fade_obj(mouth_wtf_circle, true, 0); // Show instantly
            anim_prop(mouth_wtf_circle, set_width_cb, 35, 0, 500); // Shrink width style
            anim_prop(mouth_wtf_circle, set_height_cb, 35, 0, 500); // Shrink height style
            fade_obj(mouth_wtf_circle, false, 500); // Fade out circle
            
            lv_obj_set_size(mouth_wtf, 0, 0); // Start triangle at zero
            fade_obj(mouth_wtf, true, 500); // Fade triangle in
            anim_prop(mouth_wtf, set_width_cb, 0, 40, 500); // Expand triangle width
            anim_prop(mouth_wtf, set_height_cb, 0, 30, 500); // Expand triangle height
            break;

        case EYE_STATE_LAUGH:
            update_name_label("LAUGH");
            // Bored-style half-closed eyes, pushed to top
            animate_eye_base(eye_l, 100, 165, 0, 0, -120, 400);
            animate_eye_base(eye_r, 100, 165, 0, 0, -120, 400);
            anim_prop(mask_top_l, set_ty_cb, lv_obj_get_style_translate_y(mask_top_l, 0), -30, 400);
            anim_prop(mask_top_r, set_ty_cb, lv_obj_get_style_translate_y(mask_top_r, 0), -30, 400);
            // Big capsule mouth opens revealing teeth
            lv_obj_set_size(laugh_mouth, 140, 5);
            fade_obj(laugh_mouth, true, 300);
            anim_prop(laugh_mouth, set_height_cb, 5, 70, 400);
            break;

        default: break;
    }
}

static void logic_timer_cb(lv_timer_t * t)
{
    state_time += 100;
    idle_time += 100;

    if (s_eye_state_pending) {
        s_eye_state_pending = false;
        set_eyes_state(s_pending_eye_state);
    }

    if (s_eye_color_pending) {
        s_eye_color_pending = false;
        lv_color_t color = lv_color_hex(s_eye_color_hex);
        if (eye_l) lv_obj_set_style_bg_color(eye_l, color, 0);
        if (eye_r) lv_obj_set_style_bg_color(eye_r, color, 0);
        if (mouth_arc_l) lv_obj_set_style_arc_color(mouth_arc_l, color, LV_PART_MAIN);
        if (mouth_arc_r) lv_obj_set_style_arc_color(mouth_arc_r, color, LV_PART_MAIN);
        if (interest_mouth_l) lv_obj_set_style_arc_color(interest_mouth_l, color, LV_PART_MAIN);
        if (interest_mouth_r) lv_obj_set_style_arc_color(interest_mouth_r, color, LV_PART_MAIN);
        if (mouth_yawn) lv_obj_set_style_bg_color(mouth_yawn, color, 0);
        if (tear_l) lv_obj_set_style_bg_color(tear_l, color, 0);
        if (tear_r) lv_obj_set_style_bg_color(tear_r, color, 0);
        if (mouth_triangle) lv_obj_set_style_bg_color(mouth_triangle, color, 0);
        if (ignore_hemi_l) lv_obj_set_style_bg_color(ignore_hemi_l, color, 0);
        if (ignore_hemi_r) lv_obj_set_style_bg_color(ignore_hemi_r, color, 0);
        if (mouth_wtf) lv_obj_set_style_bg_color(mouth_wtf, color, 0);
        if (mouth_wtf_circle) lv_obj_set_style_bg_color(mouth_wtf_circle, color, 0);
        if (laugh_mouth) lv_obj_set_style_bg_color(laugh_mouth, color, 0);
        if (laugh_hemi_l) lv_obj_set_style_bg_color(laugh_hemi_l, color, 0);
        if (laugh_hemi_r) lv_obj_set_style_bg_color(laugh_hemi_r, color, 0);
    }

    if (current_state == EYE_STATE_EYES_CLOSED) {
        if (state_time > 0 && state_time % 200 == 0) {
            int offset_x = (rand() % 16) - 8; // Rapid X shaking
            int offset_y = (rand() % 10) - 5; // Rapid Y shaking
            anim_prop(eye_closed_l, set_tx_cb, lv_obj_get_style_translate_x(eye_closed_l, 0), offset_x, 100);
            anim_prop(eye_closed_l, set_ty_cb, lv_obj_get_style_translate_y(eye_closed_l, 0), offset_y, 100);
            anim_prop(eye_closed_r, set_tx_cb, lv_obj_get_style_translate_x(eye_closed_r, 0), offset_x, 100);
            anim_prop(eye_closed_r, set_ty_cb, lv_obj_get_style_translate_y(eye_closed_r, 0), offset_y, 100);
        }
    }

    if (current_state == EYE_STATE_LAUGH) {
        if (state_time > 500 && state_time % 300 == 0) {
            int target_h = (state_time % 600 == 0) ? 75 : 55;
            anim_prop(laugh_mouth, set_height_cb, lv_obj_get_height(laugh_mouth), target_h, 150);
            int mouth_ty = (state_time % 600 == 0) ? 4 : -4;
            anim_prop(laugh_mouth, set_ty_cb, lv_obj_get_style_translate_y(laugh_mouth, 0), mouth_ty, 150);
        }
    }

    if (current_state == EYE_STATE_INSECURE || current_state == EYE_STATE_INTEREST || current_state == EYE_STATE_IGNORE || current_state == EYE_STATE_HAPPY_CRY || current_state == EYE_STATE_CRYING_MOUTH) {
        if (state_time > 0 && state_time % 800 == 0) {
            int offset = (rand() % 30) - 15;
            if (current_state == EYE_STATE_INSECURE) {
                anim_prop(insecure_eye_l, set_tx_cb, lv_obj_get_style_translate_x(insecure_eye_l, 0), offset, 300);
                anim_prop(insec_cover_l, set_tx_cb, lv_obj_get_style_translate_x(insec_cover_l, 0), offset, 300);
                anim_prop(insecure_eye_r, set_tx_cb, lv_obj_get_style_translate_x(insecure_eye_r, 0), offset, 300);
                anim_prop(insec_cover_r, set_tx_cb, lv_obj_get_style_translate_x(insec_cover_r, 0), offset, 300);
                anim_prop(insecure_mouth, set_tx_cb, lv_obj_get_style_translate_x(insecure_mouth, 0), offset / 2, 300);
            } else if (current_state == EYE_STATE_INTEREST) {
                // Jitter the eyes exactly like INSECURE
                anim_prop(insecure_eye_l, set_tx_cb, lv_obj_get_style_translate_x(insecure_eye_l, 0), offset, 300);
                anim_prop(insec_cover_l, set_tx_cb, lv_obj_get_style_translate_x(insec_cover_l, 0), offset, 300);
                anim_prop(insecure_eye_r, set_tx_cb, lv_obj_get_style_translate_x(insecure_eye_r, 0), offset, 300);
                anim_prop(insec_cover_r, set_tx_cb, lv_obj_get_style_translate_x(insec_cover_r, 0), offset, 300);
                // Jitter the mouth
                anim_prop(interest_mouth_l, set_tx_cb, lv_obj_get_style_translate_x(interest_mouth_l, 0), offset / 2, 300);
                anim_prop(interest_mouth_r, set_tx_cb, lv_obj_get_style_translate_x(interest_mouth_r, 0), offset / 2, 300);
            } else if (current_state == EYE_STATE_IGNORE) {
                int ty = (rand() % 15); // Slight sighing / bobbing motion
                anim_prop(ignore_line_l, set_ty_cb, lv_obj_get_style_translate_y(ignore_line_l, 0), ty, 400);
                anim_prop(ignore_hemi_l, set_ty_cb, lv_obj_get_style_translate_y(ignore_hemi_l, 0), ty, 400);
                anim_prop(ignore_line_r, set_ty_cb, lv_obj_get_style_translate_y(ignore_line_r, 0), ty, 400);
                anim_prop(ignore_hemi_r, set_ty_cb, lv_obj_get_style_translate_y(ignore_hemi_r, 0), ty, 400);
            } else if (current_state == EYE_STATE_HAPPY_CRY || current_state == EYE_STATE_CRYING_MOUTH) {
                int max_len = 70 + (rand() % 40); // 70 to 110
                anim_prop(tear_l, set_height_cb, 40, max_len, 400);
                anim_prop(tear_l, set_ty_cb, 20, max_len/2, 400);
                anim_prop(tear_r, set_height_cb, 40, max_len, 400);
                anim_prop(tear_r, set_ty_cb, 20, max_len/2, 400);
            }
        } else if (state_time > 0 && state_time % 800 == 400) {
            if (current_state == EYE_STATE_HAPPY_CRY || current_state == EYE_STATE_CRYING_MOUTH) {
                anim_prop(tear_l, set_height_cb, lv_obj_get_height(tear_l), 40, 400);
                anim_prop(tear_l, set_ty_cb, lv_obj_get_style_translate_y(tear_l, 0), 20, 400);
                anim_prop(tear_r, set_height_cb, lv_obj_get_height(tear_r), 40, 400);
                anim_prop(tear_r, set_ty_cb, lv_obj_get_style_translate_y(tear_r, 0), 20, 400);
            }
        }
    }

    // Check Accelerometer
    getAccelerometer();
    float dx = Accel.x - last_accel_x;
    float dy = Accel.y - last_accel_y;
    float dz = Accel.z - last_accel_z;
    float move_amt = (dx*dx) + (dy*dy) + (dz*dz);
    last_accel_x = Accel.x; last_accel_y = Accel.y; last_accel_z = Accel.z;

    bool tilted_up = (Accel.y > 0.6f);
    bool shaking = (move_amt > 1.5f);
    bool shaking_x = (dx*dx > 1.0f); 

    if (tilted_up) {
        idle_time = 0;
        if (shaking) {
            set_eyes_state(EYE_STATE_CRYING_MOUTH);
        } else if (current_state != EYE_STATE_CRY && current_state != EYE_STATE_CRYING_MOUTH && current_state != EYE_STATE_HAPPY_CRY) {
            set_eyes_state(EYE_STATE_CRY);
        }
    } else {
        if (move_amt > 0.05f) {
            idle_time = 0;
            if (current_state == EYE_STATE_SLEEP || current_state == EYE_STATE_EYES_CLOSED) {
                set_eyes_state(EYE_STATE_CHILL); // groggy/stretching wake up!
            } else if (current_state == EYE_STATE_BORED) {
                set_eyes_state(EYE_STATE_NORMAL);
            }
        }
        
        if (shaking && !tilted_up) {
            idle_time = 0;
            if (shaking_x && current_state != EYE_STATE_IGNORE) {
                set_eyes_state(EYE_STATE_IGNORE);
            } else if (!shaking_x && current_state != EYE_STATE_ANGRY && current_state != EYE_STATE_CRYING_MOUTH) {
                set_eyes_state(EYE_STATE_ANGRY);
            }
        }
    }

    if (current_state == EYE_STATE_BOOT) {
        if (state_time == 1000) {
            set_eyes_state(EYE_STATE_NORMAL);
        }
    } else if (current_state == EYE_STATE_NORMAL) {
        if (idle_time > 7000) {
            set_eyes_state(EYE_STATE_BORING);
        } else if (state_time >= next_look_time) {
            int32_t rx = (rand() % 100) - 50;
            int32_t ry = (rand() % 60) - 30;
            uint32_t speed = (rand() % 400) + 200;
            animate_eye_base(eye_l, 100, 165, 0, rx, ry, speed);
            animate_eye_base(eye_r, 100, 165, 0, rx, ry, speed);
            next_look_time = state_time + speed + (rand() % 3000) + 1000;
        }
    }
    else if (current_state == EYE_STATE_BORING) {
        if (state_time > 4500) set_eyes_state(EYE_STATE_BORED);
    }
    else if (current_state == EYE_STATE_BORED) {
        if (idle_time > 15000) set_eyes_state(EYE_STATE_SLEEP);
    }
    else if (current_state == EYE_STATE_SLEEP) {
        if (state_time > 10000) set_eyes_state(EYE_STATE_EYES_CLOSED);
    }
    else if (current_state == EYE_STATE_HAPPY || current_state == EYE_STATE_BLUSH || current_state == EYE_STATE_CRY || current_state == EYE_STATE_IGNORE) {
        if (state_time > 3500) set_eyes_state(EYE_STATE_NORMAL);
    }
    else if (current_state == EYE_STATE_HAPPY_CRY) {
        if (state_time > 3500) set_eyes_state(EYE_STATE_HAPPY); // Comforted -> transitions to happy first!
    }
    else if (current_state == EYE_STATE_WTF) {
        if (state_time > 2500) set_eyes_state(EYE_STATE_INTEREST); // Shocked -> curious recovery!
    }
    else if (current_state == EYE_STATE_CHILL || current_state == EYE_STATE_INSECURE || current_state == EYE_STATE_INTEREST || current_state == EYE_STATE_OOH || current_state == EYE_STATE_LAUGH) {
        if (state_time > 2500) set_eyes_state(EYE_STATE_NORMAL);
    }
    else if (current_state == EYE_STATE_ANGRY) {
        if (state_time > 5000) set_eyes_state(EYE_STATE_INSECURE);
    }
    else if (current_state == EYE_STATE_CRYING_MOUTH) {
        if (state_time > 4500) {
            if (!shaking && !tilted_up) set_eyes_state(EYE_STATE_NORMAL);
            else if (!shaking && tilted_up) set_eyes_state(EYE_STATE_CRY);
        }
    }
}

static void screen_event_cb(lv_event_t * e) {
    lv_event_code_t code = lv_event_get_code(e);
    if (code == LV_EVENT_GESTURE) {
        lv_dir_t dir = lv_indev_get_gesture_dir(lv_indev_get_act());
        idle_time = 0;
        if (dir == LV_DIR_LEFT || dir == LV_DIR_RIGHT) {
            set_eyes_state(EYE_STATE_BLUSH);
        } else if (dir == LV_DIR_TOP) {
            set_eyes_state(EYE_STATE_WTF); // Swipe Up -> Shocked surprise
        } else if (dir == LV_DIR_BOTTOM) {
            set_eyes_state(EYE_STATE_OOH); // Swipe Down -> vocalizing wonder
        }
        return;
    }

    if (code == LV_EVENT_PRESSED) {
        idle_time = 0;
        uint32_t now = lv_tick_get();
        if (now - last_tap_time < 600) tap_count++;
        else tap_count = 1;
        last_tap_time = now;

        if (tap_count >= 3) { 
            set_eyes_state(EYE_STATE_ANGRY);
        } else if (tap_count == 2) {
            if (current_state == EYE_STATE_CRY || current_state == EYE_STATE_CRYING_MOUTH) {
                set_eyes_state(EYE_STATE_HAPPY_CRY); // Comforted
            }
            else if (current_state == EYE_STATE_NORMAL || current_state == EYE_STATE_HAPPY || current_state == EYE_STATE_CHILL) {
                set_eyes_state(EYE_STATE_LAUGH); // Tickled to laughter
            }
            else {
                set_eyes_state(EYE_STATE_INTEREST);
            }
        } else if (tap_count == 1) {
            if (current_state == EYE_STATE_BORED || current_state == EYE_STATE_SLEEP || current_state == EYE_STATE_EYES_CLOSED) {
                set_eyes_state(EYE_STATE_CHILL); // Wake up groggy/stretching
            }
            else if (current_state == EYE_STATE_HAPPY || current_state == EYE_STATE_CHILL || current_state == EYE_STATE_INTEREST) {
                set_eyes_state(EYE_STATE_LAUGH); // Pet again to laugh
            }
            else if (current_state == EYE_STATE_ANGRY) {
                set_eyes_state(EYE_STATE_WTF); // Stunned/shocked
            }
            else if (current_state != EYE_STATE_BOOT && current_state != EYE_STATE_CRY && current_state != EYE_STATE_CRYING_MOUTH) {
                set_eyes_state(EYE_STATE_HAPPY);
            }
        }
    }
}

static void create_eye_masks(lv_obj_t * eye, lv_obj_t ** top_mask, lv_obj_t ** moon_mask) {
    *top_mask = lv_obj_create(eye);
    lv_obj_set_size(*top_mask, 150, 150); 
    lv_obj_set_style_bg_color(*top_mask, lv_color_black(), 0);
    lv_obj_set_style_border_width(*top_mask, 0, 0);
    lv_obj_set_style_radius(*top_mask, 0, 0);
    lv_obj_align(*top_mask, LV_ALIGN_TOP_MID, 0, 0);
    lv_obj_set_style_translate_y(*top_mask, -400, 0);
    lv_obj_clear_flag(*top_mask, LV_OBJ_FLAG_SCROLLABLE);

    *moon_mask = lv_obj_create(eye);
    lv_obj_set_size(*moon_mask, 150, 165);
    lv_obj_set_style_bg_color(*moon_mask, lv_color_black(), 0);
    lv_obj_set_style_border_width(*moon_mask, 0, 0);
    lv_obj_set_style_radius(*moon_mask, LV_RADIUS_CIRCLE, 0);
    lv_obj_align(*moon_mask, LV_ALIGN_CENTER, 0, 0);
    lv_obj_set_style_translate_y(*moon_mask, -400, 0);
    lv_obj_clear_flag(*moon_mask, LV_OBJ_FLAG_SCROLLABLE);
}

void Deskimon_Start(void)
{
    #include "../Provisioning/Provisioning.h"
    const device_config_t *cfg = Provisioning_GetConfig();
    if (cfg && cfg->eye_color != 0) {
        s_eye_color_hex = cfg->eye_color;
    }
    s_eye_color_pending = true;

    lv_obj_t * scr = lv_scr_act();
    lv_obj_add_event_cb(scr, screen_event_cb, LV_EVENT_ALL, NULL);
    lv_obj_clear_flag(scr, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_set_style_bg_color(scr, lv_color_black(), 0);
    lv_obj_set_style_bg_opa(scr, LV_OPA_COVER, 0);


    // BASE EYES
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

    // DEDICATED INSECURE/INTEREST EYES (EXACT IMAGE DESIGN USING MASKS)
    insecure_eye_l = lv_obj_create(scr);
    lv_obj_remove_style_all(insecure_eye_l);
    lv_obj_set_size(insecure_eye_l, 110, 110);
    lv_obj_set_style_radius(insecure_eye_l, LV_RADIUS_CIRCLE, 0);
    lv_obj_set_style_bg_color(insecure_eye_l, lv_color_hex(0xFF0000), 0);
    lv_obj_set_style_bg_opa(insecure_eye_l, LV_OPA_COVER, 0);
    lv_obj_align(insecure_eye_l, LV_ALIGN_CENTER, -65, -20);
    lv_obj_add_event_cb(insecure_eye_l, eye_mask_event_cb, LV_EVENT_ALL, (void*)1);
    lv_obj_set_style_opa(insecure_eye_l, 0, 0);

    insecure_eye_r = lv_obj_create(scr);
    lv_obj_remove_style_all(insecure_eye_r);
    lv_obj_set_size(insecure_eye_r, 110, 110);
    lv_obj_set_style_radius(insecure_eye_r, LV_RADIUS_CIRCLE, 0);
    lv_obj_set_style_bg_color(insecure_eye_r, lv_color_hex(0xFF0000), 0);
    lv_obj_set_style_bg_opa(insecure_eye_r, LV_OPA_COVER, 0);
    lv_obj_align(insecure_eye_r, LV_ALIGN_CENTER, 65, -20);
    lv_obj_add_event_cb(insecure_eye_r, eye_mask_event_cb, LV_EVENT_ALL, (void*)2);
    lv_obj_set_style_opa(insecure_eye_r, 0, 0);

    // Add smoothing lines over the mask cuts
    insec_cover_l = lv_line_create(scr);
    lv_obj_set_size(insec_cover_l, 412, 412);
    lv_obj_align(insec_cover_l, LV_ALIGN_CENTER, 0, 0);
    static lv_point_t l_cover_pts[] = {
        {-105 + 206, -44 + 206}, 
        {-18 + 206, -13 + 206}
    };
    lv_line_set_points(insec_cover_l, l_cover_pts, 2);
    lv_obj_set_style_line_width(insec_cover_l, 15, 0);
    lv_obj_set_style_line_color(insec_cover_l, lv_color_hex(0x00FFFF), 0);
    lv_obj_set_style_line_rounded(insec_cover_l, true, 0);
    lv_obj_set_style_opa(insec_cover_l, 0, 0);

    insec_cover_r = lv_line_create(scr);
    lv_obj_set_size(insec_cover_r, 412, 412);
    lv_obj_align(insec_cover_r, LV_ALIGN_CENTER, 0, 0);
    static lv_point_t r_cover_pts[] = {
        {18 + 206, -13 + 206}, 
        {105 + 206, -44 + 206}
    };
    lv_line_set_points(insec_cover_r, r_cover_pts, 2);
    lv_obj_set_style_line_width(insec_cover_r, 15, 0);
    lv_obj_set_style_line_color(insec_cover_r, lv_color_hex(0x00FFFF), 0);
    lv_obj_set_style_line_rounded(insec_cover_r, true, 0);
    lv_obj_set_style_opa(insec_cover_r, 0, 0);

    // MOUTHS & TEARS
    mouth_arc_l = lv_arc_create(scr);
    lv_arc_set_bg_angles(mouth_arc_l, 0, 180); 
    lv_obj_set_size(mouth_arc_l, 40, 40);
    lv_obj_remove_style(mouth_arc_l, NULL, LV_PART_INDICATOR);
    lv_obj_remove_style(mouth_arc_l, NULL, LV_PART_KNOB);
    lv_obj_set_style_arc_width(mouth_arc_l, 8, LV_PART_MAIN);
    lv_obj_set_style_arc_color(mouth_arc_l, lv_color_hex(0x00FFFF), LV_PART_MAIN);
    lv_obj_align(mouth_arc_l, LV_ALIGN_CENTER, -20, 60);
    lv_obj_set_style_opa(mouth_arc_l, 0, 0);

    mouth_arc_r = lv_arc_create(scr);
    lv_arc_set_bg_angles(mouth_arc_r, 0, 180); 
    lv_obj_set_size(mouth_arc_r, 40, 40);
    lv_obj_remove_style(mouth_arc_r, NULL, LV_PART_INDICATOR);
    lv_obj_remove_style(mouth_arc_r, NULL, LV_PART_KNOB);
    lv_obj_set_style_arc_width(mouth_arc_r, 8, LV_PART_MAIN);
    lv_obj_set_style_arc_color(mouth_arc_r, lv_color_hex(0x00FFFF), LV_PART_MAIN);
    lv_obj_align(mouth_arc_r, LV_ALIGN_CENTER, 20, 60);
    lv_obj_set_style_opa(mouth_arc_r, 0, 0);

    interest_mouth_l = lv_arc_create(scr);
    lv_arc_set_bg_angles(interest_mouth_l, 0, 180); 
    lv_obj_set_size(interest_mouth_l, 50, 50);
    lv_obj_remove_style(interest_mouth_l, NULL, LV_PART_INDICATOR);
    lv_obj_remove_style(interest_mouth_l, NULL, LV_PART_KNOB);
    lv_obj_set_style_arc_width(interest_mouth_l, 10, LV_PART_MAIN);
    lv_obj_set_style_arc_color(interest_mouth_l, lv_color_hex(0x00FFFF), LV_PART_MAIN);
    lv_obj_align(interest_mouth_l, LV_ALIGN_CENTER, -25, 60);
    lv_obj_set_style_opa(interest_mouth_l, 0, 0);

    interest_mouth_r = lv_arc_create(scr);
    lv_arc_set_bg_angles(interest_mouth_r, 0, 180); 
    lv_obj_set_size(interest_mouth_r, 50, 50);
    lv_obj_remove_style(interest_mouth_r, NULL, LV_PART_INDICATOR);
    lv_obj_remove_style(interest_mouth_r, NULL, LV_PART_KNOB);
    lv_obj_set_style_arc_width(interest_mouth_r, 10, LV_PART_MAIN);
    lv_obj_set_style_arc_color(interest_mouth_r, lv_color_hex(0x00FFFF), LV_PART_MAIN);
    lv_obj_align(interest_mouth_r, LV_ALIGN_CENTER, 25, 60);
    lv_obj_set_style_opa(interest_mouth_r, 0, 0);

    mouth_yawn = lv_obj_create(scr);
    lv_obj_set_size(mouth_yawn, 50, 70); 
    lv_obj_set_style_radius(mouth_yawn, LV_RADIUS_CIRCLE, 0);
    lv_obj_set_style_bg_color(mouth_yawn, lv_color_hex(0x00FFFF), 0);
    lv_obj_set_style_bg_opa(mouth_yawn, LV_OPA_COVER, 0);
    lv_obj_set_style_border_width(mouth_yawn, 0, 0);
    lv_obj_align(mouth_yawn, LV_ALIGN_CENTER, 0, 50); 
    lv_obj_set_style_opa(mouth_yawn, 0, 0);

    tear_l = lv_obj_create(scr);
    lv_obj_remove_style_all(tear_l);
    lv_obj_set_size(tear_l, 35, 0); // Start at height 0
    lv_obj_set_style_bg_color(tear_l, lv_color_hex(0x00FFFF), 0);
    lv_obj_set_style_bg_opa(tear_l, LV_OPA_COVER, 0);
    lv_obj_align(tear_l, LV_ALIGN_CENTER, -60, -22); // Anchored perfectly to the bottom edge (-22.5) of the squashed eye (-30)
    lv_obj_set_style_opa(tear_l, 0, 0);

    tear_r = lv_obj_create(scr);
    lv_obj_remove_style_all(tear_r);
    lv_obj_set_size(tear_r, 35, 0); // Start at height 0
    lv_obj_set_style_bg_color(tear_r, lv_color_hex(0x00FFFF), 0);
    lv_obj_set_style_bg_opa(tear_r, LV_OPA_COVER, 0);
    lv_obj_align(tear_r, LV_ALIGN_CENTER, 60, -22); // Anchored perfectly to the bottom edge of the squashed eye
    lv_obj_set_style_opa(tear_r, 0, 0);

    // EYES_CLOSED > < (Perfected large angular lines)
    eye_closed_l = lv_obj_create(scr);
    lv_obj_remove_style_all(eye_closed_l); 
    lv_obj_set_size(eye_closed_l, 80, 100);
    lv_obj_align(eye_closed_l, LV_ALIGN_CENTER, -60, 0);

    lv_obj_t * ec_l = lv_line_create(eye_closed_l);
    static lv_point_t l_pts[] = {{0,0}, {80,50}, {0,100}}; // 2 straight lines joined to form >
    lv_line_set_points(ec_l, l_pts, 3);
    lv_obj_set_style_line_width(ec_l, 14, 0);
    lv_obj_set_style_line_color(ec_l, lv_color_hex(0x00FFFF), 0);
    lv_obj_set_style_line_rounded(ec_l, true, 0);
    lv_obj_set_style_opa(eye_closed_l, 0, 0);

    eye_closed_r = lv_obj_create(scr);
    lv_obj_remove_style_all(eye_closed_r); 
    lv_obj_set_size(eye_closed_r, 80, 100);
    lv_obj_align(eye_closed_r, LV_ALIGN_CENTER, 60, 0);

    lv_obj_t * ec_r = lv_line_create(eye_closed_r);
    static lv_point_t r_pts[] = {{80,0}, {0,50}, {80,100}}; // 2 straight lines joined to form <
    lv_line_set_points(ec_r, r_pts, 3);
    lv_obj_set_style_line_width(ec_r, 14, 0);
    lv_obj_set_style_line_color(ec_r, lv_color_hex(0x00FFFF), 0);
    lv_obj_set_style_line_rounded(ec_r, true, 0);
    lv_obj_set_style_opa(eye_closed_r, 0, 0);

    // HAPPY_CRY Solid Filled Triangle Mouth
    mouth_triangle = lv_obj_create(scr);
    lv_obj_remove_style_all(mouth_triangle);
    lv_obj_set_size(mouth_triangle, 50, 30);
    lv_obj_set_style_bg_color(mouth_triangle, lv_color_hex(0x00FFFF), 0);
    lv_obj_set_style_bg_opa(mouth_triangle, LV_OPA_COVER, 0);
    lv_obj_align(mouth_triangle, LV_ALIGN_CENTER, 0, 80);
    lv_obj_add_event_cb(mouth_triangle, happy_mouth_mask_event_cb, LV_EVENT_ALL, NULL);
    lv_obj_set_style_opa(mouth_triangle, 0, 0);
    lv_obj_set_style_opa(mouth_triangle, 0, 0);

    // IGNORE HEMI L
    ignore_hemi_l = lv_obj_create(scr);
    lv_obj_remove_style_all(ignore_hemi_l);
    lv_obj_set_size(ignore_hemi_l, 60, 60);
    lv_obj_set_style_radius(ignore_hemi_l, LV_RADIUS_CIRCLE, 0);
    lv_obj_set_style_bg_color(ignore_hemi_l, lv_color_hex(0x00FFFF), 0);
    lv_obj_set_style_bg_opa(ignore_hemi_l, LV_OPA_COVER, 0);
    lv_obj_align(ignore_hemi_l, LV_ALIGN_CENTER, -110, -10);
    lv_obj_set_style_opa(ignore_hemi_l, 0, 0);

    lv_obj_t * ig_mask_l = lv_obj_create(ignore_hemi_l);
    lv_obj_remove_style_all(ig_mask_l);
    lv_obj_set_size(ig_mask_l, 80, 30); // Cover top half
    lv_obj_set_style_bg_color(ig_mask_l, lv_color_black(), 0);
    lv_obj_set_style_bg_opa(ig_mask_l, LV_OPA_COVER, 0);
    lv_obj_align(ig_mask_l, LV_ALIGN_TOP_MID, 0, 0);

    // IGNORE LINE L
    ignore_line_l = lv_line_create(scr);
    lv_obj_set_size(ignore_line_l, 412, 412);
    lv_obj_align(ignore_line_l, LV_ALIGN_CENTER, 0, 0);
    static lv_point_t ig_l_pts[] = {{-140 + 206, -10 + 206}, {-20 + 206, -10 + 206}};
    lv_line_set_points(ignore_line_l, ig_l_pts, 2);
    lv_obj_set_style_line_width(ignore_line_l, 20, 0);
    lv_obj_set_style_line_color(ignore_line_l, lv_color_hex(0x00FFFF), 0);
    lv_obj_set_style_line_rounded(ignore_line_l, true, 0);
    lv_obj_set_style_opa(ignore_line_l, 0, 0);

    // IGNORE HEMI R
    ignore_hemi_r = lv_obj_create(scr);
    lv_obj_remove_style_all(ignore_hemi_r);
    lv_obj_set_size(ignore_hemi_r, 60, 60);
    lv_obj_set_style_radius(ignore_hemi_r, LV_RADIUS_CIRCLE, 0);
    lv_obj_set_style_bg_color(ignore_hemi_r, lv_color_hex(0x00FFFF), 0);
    lv_obj_set_style_bg_opa(ignore_hemi_r, LV_OPA_COVER, 0);
    lv_obj_align(ignore_hemi_r, LV_ALIGN_CENTER, 50, -10);
    lv_obj_set_style_opa(ignore_hemi_r, 0, 0);

    lv_obj_t * ig_mask_r = lv_obj_create(ignore_hemi_r);
    lv_obj_remove_style_all(ig_mask_r);
    lv_obj_set_size(ig_mask_r, 80, 30); // Cover top half
    lv_obj_set_style_bg_color(ig_mask_r, lv_color_black(), 0);
    lv_obj_set_style_bg_opa(ig_mask_r, LV_OPA_COVER, 0);
    lv_obj_align(ig_mask_r, LV_ALIGN_TOP_MID, 0, 0);

    // IGNORE LINE R
    ignore_line_r = lv_line_create(scr);
    lv_obj_set_size(ignore_line_r, 412, 412);
    lv_obj_align(ignore_line_r, LV_ALIGN_CENTER, 0, 0);
    static lv_point_t ig_r_pts[] = {{20 + 206, -10 + 206}, {140 + 206, -10 + 206}};
    lv_line_set_points(ignore_line_r, ig_r_pts, 2);
    lv_obj_set_style_line_width(ignore_line_r, 20, 0);
    lv_obj_set_style_line_color(ignore_line_r, lv_color_hex(0x00FFFF), 0);
    lv_obj_set_style_line_rounded(ignore_line_r, true, 0);
    lv_obj_set_style_opa(ignore_line_r, 0, 0);

    // INSECURE mouth
    insecure_mouth = lv_obj_create(scr);
    lv_obj_remove_style_all(insecure_mouth); // Remove all default LVGL theme bleeds/outlines
    lv_obj_set_size(insecure_mouth, 40, 40); // Increased size
    lv_obj_set_style_radius(insecure_mouth, LV_RADIUS_CIRCLE, 0);
    lv_obj_set_style_bg_color(insecure_mouth, lv_color_hex(0xFF0000), 0);
    lv_obj_set_style_bg_opa(insecure_mouth, LV_OPA_COVER, 0);
    lv_obj_align(insecure_mouth, LV_ALIGN_CENTER, 0, 60);
    lv_obj_set_style_opa(insecure_mouth, 0, 0);

    // OOH mouth (little open circular mouth)
    mouth_ooh = lv_obj_create(scr);
    lv_obj_remove_style_all(mouth_ooh);
    lv_obj_set_size(mouth_ooh, 35, 35); // Little circular ring
    lv_obj_set_style_radius(mouth_ooh, LV_RADIUS_CIRCLE, 0);
    lv_obj_set_style_border_width(mouth_ooh, 8, 0);
    lv_obj_set_style_border_color(mouth_ooh, lv_color_hex(0x00FFFF), 0);
    lv_obj_set_style_border_opa(mouth_ooh, LV_OPA_COVER, 0);
    lv_obj_align(mouth_ooh, LV_ALIGN_CENTER, 0, 80); // Lowered mouth position
    lv_obj_set_style_opa(mouth_ooh, 0, 0);

    // WTF mouth (upward pointing triangle mouth)
    mouth_wtf = lv_obj_create(scr);
    lv_obj_remove_style_all(mouth_wtf);
    lv_obj_set_size(mouth_wtf, 40, 30);
    lv_obj_set_style_bg_color(mouth_wtf, lv_color_hex(0x00FFFF), 0);
    lv_obj_set_style_bg_opa(mouth_wtf, LV_OPA_COVER, 0);
    lv_obj_align(mouth_wtf, LV_ALIGN_CENTER, 0, 75);
    lv_obj_add_event_cb(mouth_wtf, wtf_mouth_mask_event_cb, LV_EVENT_ALL, NULL);
    lv_obj_set_style_opa(mouth_wtf, 0, 0);

    // WTF mouth morphing circle (dedicated solid cyan circle)
    mouth_wtf_circle = lv_obj_create(scr);
    lv_obj_remove_style_all(mouth_wtf_circle);
    lv_obj_set_size(mouth_wtf_circle, 35, 35);
    lv_obj_set_style_radius(mouth_wtf_circle, LV_RADIUS_CIRCLE, 0);
    lv_obj_set_style_bg_color(mouth_wtf_circle, lv_color_hex(0x00FFFF), 0);
    lv_obj_set_style_bg_opa(mouth_wtf_circle, LV_OPA_COVER, 0);
    lv_obj_align(mouth_wtf_circle, LV_ALIGN_CENTER, 0, 75);
    lv_obj_set_style_opa(mouth_wtf_circle, 0, 0);

    // LAUGH mouth (wide rounded rectangle with teeth)
    laugh_mouth = lv_obj_create(scr);
    lv_obj_remove_style_all(laugh_mouth);
    lv_obj_set_size(laugh_mouth, 140, 70);
    lv_obj_set_style_radius(laugh_mouth, LV_RADIUS_CIRCLE, 0); // Capsule/pill shape
    lv_obj_set_style_bg_color(laugh_mouth, lv_color_hex(0x00FFFF), 0);
    lv_obj_set_style_bg_opa(laugh_mouth, LV_OPA_COVER, 0);
    lv_obj_align(laugh_mouth, LV_ALIGN_CENTER, 0, 50);
    lv_obj_clear_flag(laugh_mouth, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_set_style_opa(laugh_mouth, 0, 0);

    // Tooth gap dividers (4 black vertical lines creating 5 teeth)
    static const int gap_x[] = {24, 52, 80, 108};
    for (int i = 0; i < 4; i++) {
        lv_obj_t * tg = lv_obj_create(laugh_mouth);
        lv_obj_remove_style_all(tg);
        lv_obj_set_size(tg, 5, 80);
        lv_obj_set_style_bg_color(tg, lv_color_black(), 0);
        lv_obj_set_style_bg_opa(tg, LV_OPA_COVER, 0);
        lv_obj_align(tg, LV_ALIGN_LEFT_MID, gap_x[i], 0);
    }

    // LAUGH hemispheres (small semicircles below line eyes for slightly open eye effect)
    laugh_hemi_l = lv_obj_create(scr);
    lv_obj_remove_style_all(laugh_hemi_l);
    lv_obj_set_size(laugh_hemi_l, 30, 30);
    lv_obj_set_style_radius(laugh_hemi_l, LV_RADIUS_CIRCLE, 0);
    lv_obj_set_style_bg_color(laugh_hemi_l, lv_color_hex(0x00FFFF), 0);
    lv_obj_set_style_bg_opa(laugh_hemi_l, LV_OPA_COVER, 0);
    lv_obj_align(laugh_hemi_l, LV_ALIGN_CENTER, -60, -32);
    lv_obj_clear_flag(laugh_hemi_l, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_set_style_opa(laugh_hemi_l, 0, 0);

    lv_obj_t * lh_mask_l = lv_obj_create(laugh_hemi_l);
    lv_obj_remove_style_all(lh_mask_l);
    lv_obj_set_size(lh_mask_l, 40, 15);
    lv_obj_set_style_bg_color(lh_mask_l, lv_color_black(), 0);
    lv_obj_set_style_bg_opa(lh_mask_l, LV_OPA_COVER, 0);
    lv_obj_align(lh_mask_l, LV_ALIGN_TOP_MID, 0, 0);

    laugh_hemi_r = lv_obj_create(scr);
    lv_obj_remove_style_all(laugh_hemi_r);
    lv_obj_set_size(laugh_hemi_r, 30, 30);
    lv_obj_set_style_radius(laugh_hemi_r, LV_RADIUS_CIRCLE, 0);
    lv_obj_set_style_bg_color(laugh_hemi_r, lv_color_hex(0x00FFFF), 0);
    lv_obj_set_style_bg_opa(laugh_hemi_r, LV_OPA_COVER, 0);
    lv_obj_align(laugh_hemi_r, LV_ALIGN_CENTER, 60, -32);
    lv_obj_clear_flag(laugh_hemi_r, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_set_style_opa(laugh_hemi_r, 0, 0);

    lv_obj_t * lh_mask_r = lv_obj_create(laugh_hemi_r);
    lv_obj_remove_style_all(lh_mask_r);
    lv_obj_set_size(lh_mask_r, 40, 15);
    lv_obj_set_style_bg_color(lh_mask_r, lv_color_black(), 0);
    lv_obj_set_style_bg_opa(lh_mask_r, LV_OPA_COVER, 0);
    lv_obj_align(lh_mask_r, LV_ALIGN_TOP_MID, 0, 0);

    logic_timer = lv_timer_create(logic_timer_cb, 100, NULL);
}

void Deskimon_SetEyeColor(uint32_t color_hex)
{
    s_eye_color_hex = color_hex;
    s_eye_color_pending = true;
}

void Deskimon_SetEmotion(const char* emotion)
{
    eye_state_t state = EYE_STATE_NORMAL;
    if (strcmp(emotion, "happy") == 0) {
        state = EYE_STATE_HAPPY;
    } else if (strcmp(emotion, "angry") == 0) {
        state = EYE_STATE_ANGRY;
    } else if (strcmp(emotion, "sleepy") == 0) {
        state = EYE_STATE_SLEEP;
    } else if (strcmp(emotion, "crying") == 0 || strcmp(emotion, "cry") == 0) {
        state = EYE_STATE_CRY;
    } else if (strcmp(emotion, "interest") == 0 || strcmp(emotion, "listening") == 0) {
        state = EYE_STATE_INTEREST;
    } else if (strcmp(emotion, "ooh") == 0) {
        state = EYE_STATE_OOH;
    } else if (strcmp(emotion, "wtf") == 0) {
        state = EYE_STATE_WTF;
    } else if (strcmp(emotion, "laugh") == 0) {
        state = EYE_STATE_LAUGH;
    } else if (strcmp(emotion, "bored") == 0) {
        state = EYE_STATE_BORED;
    } else if (strcmp(emotion, "blush") == 0) {
        state = EYE_STATE_BLUSH;
    } else if (strcmp(emotion, "chill") == 0) {
        state = EYE_STATE_CHILL;
    }
    s_pending_eye_state = state;
    s_eye_state_pending = true;
}

