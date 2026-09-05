/*
 * The Library of Babel - Infinite Virtual FAT32 USB Driver for RP2040
 * Clean 4KB Cluster FAT32 implementation for 100% Windows Explorer compatibility.
 */

#include "bsp/board_api.h"
#include "tusb.h"
#include <string.h>
#include <stdio.h>

#define SECTOR_SIZE           512
#define SECTORS_PER_CLUSTER   8U        // 4,096 bytes per cluster (Standard FAT32)
#define TOTAL_SECTORS         4194304U  // 2 Gigabytes virtual drive (524,288 clusters)
#define RESERVED_SECTORS      32U
#define NUM_FATS              2U
#define SECTORS_PER_FAT       4096U     // 4096 * 512 = 2MB FAT (covers 524,288 clusters)
#define FIRST_DATA_SECTOR     (RESERVED_SECTORS + NUM_FATS * SECTORS_PER_FAT) // 8224
#define ROOT_CLUSTER          2U

#define CLUSTER_README        3U        // Odd cluster: README.TXT file
#define CLUSTER_EXPLORE       5U        // Odd cluster: EXPLORE.HTM file

#define BRANCH_FACTOR         8U        // Subfolders 0 through 7
#define PAGE_FILE_SIZE        3280U     // 40 lines * (80 chars + CRLF) = 3280 bytes

// 29-character Borges alphabet
static const char BORGES_ALPHABET[] = " abcdefghijklmnopqrstuvwxyz,.";
#define BORGES_ALPHA_LEN      29

#pragma pack(push, 1)
typedef struct {
    uint8_t  name[11];
    uint8_t  attr;
    uint8_t  nt_res;
    uint8_t  crt_time_tenth;
    uint16_t crt_time;
    uint16_t crt_date;
    uint16_t lst_acc_date;
    uint16_t fst_clus_hi;
    uint16_t wrt_time;
    uint16_t wrt_date;
    uint16_t fst_clus_lo;
    uint32_t file_size;
} fat_dir_entry_t;
#pragma pack(pop)

static const char README_CONTENT[] =
    "======================================================================\r\n"
    "         THE LIBRARY OF BABEL • INFINITE USB FILESYSTEM\r\n"
    "                      Raspberry Pi Pico 2020\r\n"
    "======================================================================\r\n\r\n"
    "Welcome to Jorge Luis Borges' Library of Babel.\r\n\r\n"
    "This USB drive is a procedurally generated infinite FAT32 filesystem.\r\n"
    "You can navigate folders 0 through 7 infinitely deep into the universe.\r\n"
    "Inside each chamber you will find 'PAGE.TXT', which contains the exact\r\n"
    "40-line, 3,200-character page for that cosmic coordinate.\r\n\r\n"
    "Every book that has ever been written, every secret, and infinite noise\r\n"
    "lies somewhere in these branches.\r\n\r\n"
    "Happy exploring!\r\n";

static const char EXPLORE_REDIRECT_HTML[] =
    "<!DOCTYPE html><html><head><meta http-equiv=\"refresh\" content=\"0; url=https://libraryofbabel.info\"></head>"
    "<body style=\"background:#090a0f;color:#e6af2e;font-family:sans-serif;text-align:center;padding:50px;\">"
    "<h2>Entering the Library of Babel...</h2><p>RP2040 Infinite Virtual Storage Active</p></body></html>";

static inline uint64_t splitmix64(uint64_t *state) {
    uint64_t z = (*state += 0x9E3779B97F4A7C15ULL);
    z = (z ^ (z >> 30)) * 0xBF58476D1CE4E5B9ULL;
    z = (z ^ (z >> 27)) * 0x94D049BB133111EBULL;
    return z ^ (z >> 31);
}

static char get_babel_char(uint32_t chamber_cluster, uint32_t char_idx) {
    uint64_t state = ((uint64_t)chamber_cluster * 6364136223846793005ULL) + (uint64_t)char_idx * 0x9E3779B97F4A7C15ULL + 1442695040888963407ULL;
    return BORGES_ALPHABET[splitmix64(&state) % BORGES_ALPHA_LEN];
}

static void generate_page_sector(uint32_t chamber_cluster, uint32_t sec_in_cluster, uint8_t *buffer) {
    memset(buffer, ' ', SECTOR_SIZE);
    uint32_t char_offset = sec_in_cluster * SECTOR_SIZE;

    if (sec_in_cluster == 0) {
        char header[128];
        int hlen = snprintf(header, sizeof(header),
            "--- THE LIBRARY OF BABEL --- Chamber: 0x%08lX ---\r\n\r\n", (unsigned long)chamber_cluster);
        memcpy(buffer, header, hlen);
        for (int i = hlen; i < SECTOR_SIZE; i++) {
            if (i % 82 == 80) buffer[i] = '\r';
            else if (i % 82 == 81) buffer[i] = '\n';
            else buffer[i] = get_babel_char(chamber_cluster, i);
        }
    } else if (sec_in_cluster < 7) {
        for (int i = 0; i < SECTOR_SIZE; i++) {
            uint32_t global_idx = char_offset + i;
            if (global_idx >= PAGE_FILE_SIZE) {
                buffer[i] = (global_idx == PAGE_FILE_SIZE) ? '\n' : ' ';
                continue;
            }
            if (global_idx % 82 == 80) buffer[i] = '\r';
            else if (global_idx % 82 == 81) buffer[i] = '\n';
            else buffer[i] = get_babel_char(chamber_cluster, global_idx);
        }
    } else {
        // Sector 7 is padding
        memset(buffer, 0, SECTOR_SIZE);
    }
}

static void fill_dir_entry(fat_dir_entry_t *entry, const char *name83, uint8_t attr, uint32_t cluster, uint32_t size) {
    memcpy(entry->name, name83, 11);
    entry->attr = attr;
    entry->nt_res = 0;
    entry->crt_time_tenth = 0;
    entry->crt_time = 0;
    entry->crt_date = 0x5821; // 2024-01-01
    entry->lst_acc_date = 0x5821;
    entry->fst_clus_hi = (uint16_t)(cluster >> 16);
    entry->wrt_time = 0;
    entry->wrt_date = 0x5821;
    entry->fst_clus_lo = (uint16_t)(cluster & 0xFFFF);
    entry->file_size = size;
}

// Generates child cluster for subfolder k (0..7) of parent chamber cluster
static uint32_t get_child_cluster(uint32_t parent_cluster, uint32_t k) {
    uint64_t hash = ((uint64_t)parent_cluster * 6364136223846793005ULL) + (uint64_t)k * 2654435761ULL + 0xDEADBEEFULL;
    uint32_t clus = (uint32_t)((hash % 240000ULL) * 2 + 10);
    return clus; // Always even, in range [10, 480010]
}

static void generate_dir_sector(uint32_t cluster, uint8_t *buffer) {
    memset(buffer, 0, SECTOR_SIZE);
    fat_dir_entry_t *entries = (fat_dir_entry_t*)buffer;

    if (cluster == ROOT_CLUSTER) {
        // Root Directory
        fill_dir_entry(&entries[0], "BABEL_USB  ", 0x08, 0, 0); // Volume Label
        fill_dir_entry(&entries[1], "README  TXT", 0x20, CLUSTER_README, sizeof(README_CONTENT) - 1);
        fill_dir_entry(&entries[2], "EXPLORE HTM", 0x20, CLUSTER_EXPLORE, sizeof(EXPLORE_REDIRECT_HTML) - 1);

        for (uint32_t i = 0; i < BRANCH_FACTOR; i++) {
            char name[12];
            snprintf(name, sizeof(name), "%lu          ", (unsigned long)i);
            uint32_t child_cluster = get_child_cluster(ROOT_CLUSTER, i);
            fill_dir_entry(&entries[3 + i], name, 0x10, child_cluster, 0);
        }
    } else {
        // Subdirectory
        // Entry 0: . (self)
        fill_dir_entry(&entries[0], ".          ", 0x10, cluster, 0);

        // Entry 1: .. (parent)
        fill_dir_entry(&entries[1], "..         ", 0x10, ROOT_CLUSTER, 0);

        // Subfolders 0 through 7
        for (uint32_t i = 0; i < BRANCH_FACTOR; i++) {
            char name[12];
            snprintf(name, sizeof(name), "%lu          ", (unsigned long)i);
            uint32_t child_cluster = get_child_cluster(cluster, i);
            fill_dir_entry(&entries[2 + i], name, 0x10, child_cluster, 0);
        }

        // PAGE.TXT for this chamber (cluster + 1 is always odd)
        fill_dir_entry(&entries[2 + BRANCH_FACTOR], "PAGE    TXT", 0x20, cluster + 1, PAGE_FILE_SIZE);
    }
}

// Invoked when received Test Unit Ready command
bool tud_msc_test_unit_ready_cb(uint8_t lun) {
    (void) lun;
    return true;
}

// Invoked when received Inquiry command
void tud_msc_inquiry_cb(uint8_t lun, uint8_t vendor_id[8], uint8_t product_id[16], uint8_t product_rev[4]) {
    (void) lun;
    memcpy(vendor_id,  "BORGES  ", 8);
    memcpy(product_id, "BABEL_INFINITE  ", 16);
    memcpy(product_rev, "1.0 ", 4);
}

// Invoked when received Read Capacity 10 command
void tud_msc_capacity_cb(uint8_t lun, uint32_t* block_count, uint16_t* block_size) {
    (void) lun;
    *block_size = SECTOR_SIZE;
    *block_count = TOTAL_SECTORS;
}

// Invoked when received Start Stop Unit command
bool tud_msc_start_stop_cb(uint8_t lun, uint8_t power_condition, bool start, bool load_eject) {
    (void) lun; (void) power_condition; (void) start; (void) load_eject;
    return true;
}

// SCSI Read10 callback - handles on-the-fly sector synthesis
int32_t tud_msc_read10_cb(uint8_t lun, uint32_t lba, uint32_t offset, void* buffer, uint32_t bufsize) {
    (void) lun; (void) offset;
    uint8_t *buf = (uint8_t*)buffer;
    memset(buf, 0, bufsize);

    if (lba == 0) {
        // Sector 0: Master Boot Record (MBR)
        buf[0x1BE] = 0x80; // Bootable
        buf[0x1BF] = 0x01; // Starting head
        buf[0x1C0] = 0x01; // Starting sector
        buf[0x1C1] = 0x00; // Starting cylinder
        buf[0x1C2] = 0x0C; // FAT32 with LBA
        buf[0x1C3] = 0xFE; // Ending head
        buf[0x1C4] = 0xFF; // Ending sector
        buf[0x1C5] = 0xFF; // Ending cylinder
        // LBA of partition 1 = RESERVED_SECTORS (32)
        uint32_t part_lba = RESERVED_SECTORS;
        memcpy(&buf[0x1C6], &part_lba, 4);
        uint32_t part_size = TOTAL_SECTORS - RESERVED_SECTORS;
        memcpy(&buf[0x1CA], &part_size, 4);
        buf[510] = 0x55;
        buf[511] = 0xAA;
        return (int32_t)bufsize;
    }

    if (lba == 32 || lba == 38) {
        // FAT32 Volume Boot Record (BPB) at LBA 32 and backup at LBA 38
        buf[0] = 0xEB; buf[1] = 0x58; buf[2] = 0x90; // JMP SHORT, NOP
        memcpy(&buf[3], "BABELUSB", 8);              // OEM Name
        buf[11] = 0x00; buf[12] = 0x02;              // Bytes per sector (512)
        buf[13] = (uint8_t)SECTORS_PER_CLUSTER;      // Sectors per cluster (8 = 4KB)
        uint16_t res_sec = RESERVED_SECTORS;
        memcpy(&buf[14], &res_sec, 2);               // Reserved sectors (32)
        buf[16] = (uint8_t)NUM_FATS;                 // Number of FATs (2)
        buf[17] = 0; buf[18] = 0;                    // Root entries (0 for FAT32)
        buf[19] = 0; buf[20] = 0;                    // Total sectors 16 (0)
        buf[21] = 0xF8;                              // Media descriptor (Fixed disk)
        buf[22] = 0; buf[23] = 0;                    // Sectors per FAT 16 (0)
        buf[24] = 63; buf[25] = 0;                   // Sectors per track
        buf[26] = 255; buf[27] = 0;                  // Heads
        uint32_t hidden_sec = RESERVED_SECTORS;
        memcpy(&buf[28], &hidden_sec, 4);            // Hidden sectors
        uint32_t total_sec = TOTAL_SECTORS - RESERVED_SECTORS;
        memcpy(&buf[32], &total_sec, 4);             // Total sectors 32
        uint32_t fat_sz = SECTORS_PER_FAT;
        memcpy(&buf[36], &fat_sz, 4);                // Sectors per FAT 32
        buf[40] = 0; buf[41] = 0;                    // Ext flags
        buf[42] = 0; buf[43] = 0;                    // FS Version
        uint32_t root_clus = ROOT_CLUSTER;
        memcpy(&buf[44], &root_clus, 4);             // Root cluster (2)
        buf[48] = 1; buf[49] = 0;                    // FSInfo sector (1, relative = 33)
        buf[50] = 6; buf[51] = 0;                    // Backup boot sector (6, relative = 38)
        buf[64] = 0x80;                              // Drive number
        buf[66] = 0x29;                              // Extended boot signature
        buf[67] = 0x42; buf[68] = 0x41; buf[69] = 0x42; buf[70] = 0x45; // Vol ID ("BABE")
        memcpy(&buf[71], "BABEL_USB  ", 11);         // Volume label
        memcpy(&buf[82], "FAT32   ", 8);              // File system type
        buf[510] = 0x55;
        buf[511] = 0xAA;
        return (int32_t)bufsize;
    }

    if (lba == 33 || lba == 39) {
        // Sector 33 (or backup 39): FSInfo Sector
        buf[0] = 0x52; buf[1] = 0x52; buf[2] = 0x61; buf[3] = 0x41; // "RRaA"
        buf[484] = 0x72; buf[485] = 0x72; buf[486] = 0x41; buf[487] = 0x61; // "rrAa"
        uint32_t free_clust = 0x00070000;
        memcpy(&buf[488], &free_clust, 4);
        uint32_t next_clust = 7;
        memcpy(&buf[492], &next_clust, 4);
        buf[510] = 0x55;
        buf[511] = 0xAA;
        return (int32_t)bufsize;
    }

    // FAT 1 (LBA 32 + 32 .. 32 + 4096 - 1) and FAT 2
    uint32_t fat1_start = RESERVED_SECTORS;
    uint32_t fat2_start = RESERVED_SECTORS + SECTORS_PER_FAT;
    if ((lba >= fat1_start && lba < fat1_start + SECTORS_PER_FAT) ||
        (lba >= fat2_start && lba < fat2_start + SECTORS_PER_FAT)) {
        uint32_t fat_offset = (lba >= fat2_start) ? (lba - fat2_start) : (lba - fat1_start);
        uint32_t *fat_entries = (uint32_t*)buf;
        
        // Every single cluster allocated is single-cluster EOF (0x0FFFFFFF)
        for (int i = 0; i < 128; i++) {
            fat_entries[i] = 0x0FFFFFFFU;
        }

        if (fat_offset == 0) {
            fat_entries[0] = 0x0FFFFFF8U; // Media descriptor
            fat_entries[1] = 0x0FFFFFFFU; // Clean shutdown bit
            fat_entries[2] = 0x0FFFFFFFU; // Root cluster (EOF)
        }
        return (int32_t)bufsize;
    }

    // Data Clusters (LBA 8224 onwards)
    if (lba >= FIRST_DATA_SECTOR) {
        uint32_t cluster_offset = (lba - FIRST_DATA_SECTOR);
        uint32_t cluster = 2 + (cluster_offset / SECTORS_PER_CLUSTER);
        uint32_t sec_in_cluster = cluster_offset % SECTORS_PER_CLUSTER;

        if (cluster == ROOT_CLUSTER) {
            if (sec_in_cluster == 0) {
                generate_dir_sector(ROOT_CLUSTER, buf);
            }
            return (int32_t)bufsize;
        }

        if (cluster == CLUSTER_README) {
            if (sec_in_cluster == 0) {
                memcpy(buf, README_CONTENT, sizeof(README_CONTENT) - 1);
            }
            return (int32_t)bufsize;
        }

        if (cluster == CLUSTER_EXPLORE) {
            if (sec_in_cluster == 0) {
                memcpy(buf, EXPLORE_REDIRECT_HTML, sizeof(EXPLORE_REDIRECT_HTML) - 1);
            }
            return (int32_t)bufsize;
        }

        if (cluster & 1) {
            // Odd cluster = PAGE.TXT file for chamber (cluster - 1)
            uint32_t chamber_cluster = cluster - 1;
            generate_page_sector(chamber_cluster, sec_in_cluster, buf);
            return (int32_t)bufsize;
        } else {
            // Even cluster = Directory cluster
            if (sec_in_cluster == 0) {
                generate_dir_sector(cluster, buf);
            }
            return (int32_t)bufsize;
        }
    }

    return (int32_t)bufsize;
}

// SCSI Write10 callback - dummy write absorption
int32_t tud_msc_write10_cb(uint8_t lun, uint32_t lba, uint32_t offset, uint8_t* buffer, uint32_t bufsize) {
    (void) lun; (void) lba; (void) offset; (void) buffer;
    return (int32_t)bufsize;
}

// SCSI is writable
bool tud_msc_is_writable_cb(uint8_t lun) {
    (void) lun;
    return false; // Read-only infinite library!
}

// Invoked when received an SCSI command not in built-in list
int32_t tud_msc_scsi_cb(uint8_t lun, uint8_t const scsi_cmd[16], void* buffer, uint16_t bufsize) {
    (void) lun; (void) scsi_cmd; (void) buffer; (void) bufsize;
    return -1;
}

// SCSI Command Complete
void tud_msc_scsi_complete_cb(uint8_t lun, uint8_t const scsi_cmd[16]) {
    (void) lun; (void) scsi_cmd;
}
