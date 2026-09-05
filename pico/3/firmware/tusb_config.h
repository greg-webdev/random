#ifndef _TUSB_CONFIG_H_
#define _TUSB_CONFIG_H_

#ifdef __cplusplus
 extern "C" {
#endif

// Board / Port mode
#define CFG_TUSB_MCU                OPT_MCU_RP2040
#define CFG_TUSB_OS                 OPT_OS_NONE
#define CFG_TUSB_RHPORT0_MODE       (OPT_MODE_DEVICE | OPT_MODE_FULL_SPEED)

// Device configuration
#define CFG_TUD_ENABLED             1
#define CFG_TUD_MAX_SPEED           OPT_MODE_DEFAULT_SPEED
#define CFG_TUD_ENDPOINT0_SIZE      64

// Mass Storage Class (MSC) enabled
#define CFG_TUD_MSC                 1
#define CFG_TUD_MSC_EP_BUFSIZE      512

// CDC (Serial) enabled
#define CFG_TUD_CDC                 1
#define CFG_TUD_CDC_RX_BUFSIZE      512
#define CFG_TUD_CDC_TX_BUFSIZE      512

#ifdef __cplusplus
 }
#endif

#endif /* _TUSB_CONFIG_H_ */
