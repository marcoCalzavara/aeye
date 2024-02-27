import {
    button_size,
    carousel_container_margin_bottom,
    carousel_container_margin_top,
    height_transition,
    margin_between_images_bottom,
    responsive_carousel_heights,
    responsive_heights,
    responsive_margins,
    responsive_menu_item_heights
} from "./CONSTANTS";

export function getResponsiveMargin() {
    switch (true) {
        case document.documentElement.clientWidth >= 320 && document.documentElement.clientWidth <= 480:
            return responsive_margins.m_side_320;
        case document.documentElement.clientWidth > 480 && document.documentElement.clientWidth <= 768:
            return responsive_margins.m_side_480;
        case document.documentElement.clientWidth > 768 && document.documentElement.clientWidth <= 1024:
            return responsive_margins.m_side_768;
        case document.documentElement.clientWidth > 1024 && document.documentElement.clientWidth <= 1200:
            return responsive_margins.m_side_1024;
        case document.documentElement.clientWidth > 1200:
            return responsive_margins.m_side_1200;
        default:
            return responsive_margins.m_side_320;
    }
}

export function getResponsiveHeight() {
    switch (true) {
        case document.documentElement.clientWidth >= 320 && document.documentElement.clientWidth <= 480:
            return responsive_heights.h_sticky_320;
        case document.documentElement.clientWidth > 480 && document.documentElement.clientWidth <= 768:
            return responsive_heights.h_sticky_480;
        case document.documentElement.clientWidth > 768 && document.documentElement.clientWidth <= 1024:
            return responsive_heights.h_sticky_768;
        case document.documentElement.clientWidth > 1024 && document.documentElement.clientWidth <= 1200:
            return responsive_heights.h_sticky_1024;
        case document.documentElement.clientWidth > 1200:
            return responsive_heights.h_sticky_1200;
        default:
            return responsive_heights.h_sticky_320;
    }
}

export function getButtonSize() {
    return button_size;
}

export function getCarouselContainerMarginTop() {
    return carousel_container_margin_top;
}

export function getCarouselContainerMarginBottom() {
    return carousel_container_margin_bottom;
}

export function getResponsiveMenuItemHeight() {
    switch (true) {
        case document.documentElement.clientWidth >= 320 && document.documentElement.clientWidth <= 480:
            return responsive_menu_item_heights.h_item_320;
        case document.documentElement.clientWidth > 480 && document.documentElement.clientWidth <= 768:
            return responsive_menu_item_heights.h_item_480;
        case document.documentElement.clientWidth > 768 && document.documentElement.clientWidth <= 1024:
            return responsive_menu_item_heights.h_item_768;
        case document.documentElement.clientWidth > 1024 && document.documentElement.clientWidth <= 1200:
            return responsive_menu_item_heights.h_item_1024;
        case document.documentElement.clientWidth > 1200:
            return responsive_menu_item_heights.h_item_1200;
        default:
            return responsive_menu_item_heights.h_item_320;
    }
}

export function getUrlForImage(path, dataset, host = "") {
    return `${host}/${dataset}/resized_images/${path}`;
}


function getResponsiveCarouselHeight() {
    switch (true) {
        case document.documentElement.clientWidth >= 320 && document.documentElement.clientWidth <= 480:
            return responsive_carousel_heights.h_carousel_320;
        case document.documentElement.clientWidth > 480 && document.documentElement.clientWidth <= 768:
            return responsive_carousel_heights.h_carousel_480;
        case document.documentElement.clientWidth > 768 && document.documentElement.clientWidth <= 1024:
            return responsive_carousel_heights.h_carousel_768;
        case document.documentElement.clientWidth > 1024 && document.documentElement.clientWidth <= 1200:
            return responsive_carousel_heights.h_carousel_1024;
        case document.documentElement.clientWidth > 1200:
            return responsive_carousel_heights.h_carousel_1200;
        default:
            return responsive_carousel_heights.h_carousel_320;
    }

}

function vhToPixels(vh) {
    return (window.innerHeight * parseFloat(vh)) / 100;
}

export function getMaxHeightMainImage() {
    return vhToPixels(height_transition.replace('vh', '')) - getResponsiveCarouselHeight().replace("px", "")
        - margin_between_images_bottom.replace("px", "");
}