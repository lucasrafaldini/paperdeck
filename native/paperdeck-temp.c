// paperdeck-temp — prints Apple Silicon temperature sensors as JSON.
//
// Reads the SoC/NAND thermal sensors through the IOHIDEventSystem client, the
// same source Activity-style monitors use. Unlike `powermetrics` it needs no
// root. These symbols are private but long-stable; on Macs without such
// sensors (Intel) the output is simply `[]`.
//
// Output: [{"name":"PMU tdie1","c":42.5}, ...]
// Build:  node scripts/build-native.js

#include <CoreFoundation/CoreFoundation.h>
#include <stdio.h>

typedef struct __IOHIDEventSystemClient *IOHIDEventSystemClientRef;
typedef struct __IOHIDServiceClient *IOHIDServiceClientRef;
typedef struct __IOHIDEvent *IOHIDEventRef;

IOHIDEventSystemClientRef IOHIDEventSystemClientCreate(CFAllocatorRef allocator);
int IOHIDEventSystemClientSetMatching(IOHIDEventSystemClientRef client, CFDictionaryRef matching);
CFArrayRef IOHIDEventSystemClientCopyServices(IOHIDEventSystemClientRef client);
CFTypeRef IOHIDServiceClientCopyProperty(IOHIDServiceClientRef service, CFStringRef key);
IOHIDEventRef IOHIDServiceClientCopyEvent(IOHIDServiceClientRef service, int64_t type, int32_t options, int64_t timeout);
double IOHIDEventGetFloatValue(IOHIDEventRef event, int32_t field);

#define kIOHIDEventTypeTemperature 15
#define kHIDPageAppleVendor 0xff00
#define kHIDUsageAppleVendorTemperatureSensor 5

static void print_json_string(const char *value) {
  putchar('"');
  for (const unsigned char *c = (const unsigned char *)value; *c; c++) {
    if (*c == '"' || *c == '\\') printf("\\%c", *c);
    else if (*c < 0x20) printf("\\u%04x", *c);
    else putchar(*c);
  }
  putchar('"');
}

int main(void) {
  int page = kHIDPageAppleVendor;
  int usage = kHIDUsageAppleVendorTemperatureSensor;
  CFNumberRef pageNumber = CFNumberCreate(kCFAllocatorDefault, kCFNumberIntType, &page);
  CFNumberRef usageNumber = CFNumberCreate(kCFAllocatorDefault, kCFNumberIntType, &usage);
  const void *keys[] = { CFSTR("PrimaryUsagePage"), CFSTR("PrimaryUsage") };
  const void *values[] = { pageNumber, usageNumber };
  CFDictionaryRef matching = CFDictionaryCreate(kCFAllocatorDefault, keys, values, 2,
    &kCFTypeDictionaryKeyCallBacks, &kCFTypeDictionaryValueCallBacks);

  IOHIDEventSystemClientRef client = IOHIDEventSystemClientCreate(kCFAllocatorDefault);
  CFArrayRef services = NULL;
  if (client) {
    IOHIDEventSystemClientSetMatching(client, matching);
    services = IOHIDEventSystemClientCopyServices(client);
  }

  printf("[");
  int first = 1;
  CFIndex count = services ? CFArrayGetCount(services) : 0;
  for (CFIndex i = 0; i < count; i++) {
    IOHIDServiceClientRef service = (IOHIDServiceClientRef)CFArrayGetValueAtIndex(services, i);
    IOHIDEventRef event = IOHIDServiceClientCopyEvent(service, kIOHIDEventTypeTemperature, 0, 0);
    if (!event) continue;
    double celsius = IOHIDEventGetFloatValue(event, kIOHIDEventTypeTemperature << 16);
    CFRelease(event);
    // Drop disconnected/placeholder readings.
    if (!(celsius > -40.0 && celsius < 150.0)) continue;

    char name[128] = "sensor";
    CFTypeRef product = IOHIDServiceClientCopyProperty(service, CFSTR("Product"));
    if (product) {
      if (CFGetTypeID(product) == CFStringGetTypeID()) {
        CFStringGetCString((CFStringRef)product, name, sizeof name, kCFStringEncodingUTF8);
      }
      CFRelease(product);
    }

    printf("%s{\"name\":", first ? "" : ",");
    print_json_string(name);
    printf(",\"c\":%.1f}", celsius);
    first = 0;
  }
  printf("]\n");

  if (services) CFRelease(services);
  if (client) CFRelease(client);
  CFRelease(matching);
  CFRelease(pageNumber);
  CFRelease(usageNumber);
  return 0;
}
