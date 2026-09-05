cmake_minimum_required(VERSION 3.13)

include(pico_sdk_import.cmake)

project(babel_infinite_usb C CXX ASM)
set(CMAKE_C_STANDARD 11)
set(CMAKE_CXX_STANDARD 17)

# Initialize the Raspberry Pi Pico SDK
pico_sdk_init()

add_executable(babel_infinite_usb
    main.c
    usb_descriptors.c
    msc_disk.c
)

target_include_directories(babel_infinite_usb PRIVATE
    ${CMAKE_CURRENT_LIST_DIR}
)

target_link_libraries(babel_infinite_usb
    pico_stdlib
    tinyusb_device
    tinyusb_board
)

# Enable USB, disable UART
pico_enable_stdio_usb(babel_infinite_usb 0)
pico_enable_stdio_uart(babel_infinite_usb 0)

# Generate UF2, BIN, HEX, MAP
pico_add_extra_outputs(babel_infinite_usb)
