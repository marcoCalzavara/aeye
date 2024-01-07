export const responsive_margins = {
    m_side_320: getComputedStyle(document.documentElement).getPropertyValue("--m-canvas-side-320"),
    m_side_480: getComputedStyle(document.documentElement).getPropertyValue("--m-canvas-side-480"),
    m_side_768: getComputedStyle(document.documentElement).getPropertyValue("--m-canvas-side-768"),
    m_side_1024: getComputedStyle(document.documentElement).getPropertyValue("--m-canvas-side-1024"),
    m_side_1200: getComputedStyle(document.documentElement).getPropertyValue("--m-canvas-side-1200"),
};

export const responsive_heights = {
    h_sticky_320: getComputedStyle(document.documentElement).getPropertyValue("--h-sticky-320"),
    h_sticky_480: getComputedStyle(document.documentElement).getPropertyValue("--h-sticky-480"),
    h_sticky_768: getComputedStyle(document.documentElement).getPropertyValue("--h-sticky-768"),
    h_sticky_1024: getComputedStyle(document.documentElement).getPropertyValue("--h-sticky-1024"),
    h_sticky_1200: getComputedStyle(document.documentElement).getPropertyValue("--h-sticky-1200"),
};

export const responsive_menu_item_heights = {
    h_item_320: getComputedStyle(document.documentElement).getPropertyValue("--h-item-320"),
    h_item_480: getComputedStyle(document.documentElement).getPropertyValue("--h-item-480"),
    h_item_768: getComputedStyle(document.documentElement).getPropertyValue("--h-item-768"),
    h_item_1024: getComputedStyle(document.documentElement).getPropertyValue("--h-item-1024"),
    h_item_1200: getComputedStyle(document.documentElement).getPropertyValue("--h-item-1200"),
};