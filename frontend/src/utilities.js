import {responsive_heights, responsive_margins, responsive_menu_item_heights,
    button_size, carousel_container_margin_top, carousel_container_margin_bottom} from "./CONSTANTS";

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

export function getCarouselSizeWhenClosed() {
    return parseInt(button_size.replace("px", "")) +
        parseInt(carousel_container_margin_top.replace("px", "")) +
        parseInt(carousel_container_margin_bottom.replace("px", ""));
}

export function getCarouselContainerMarginTop() {
    return carousel_container_margin_top;
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

