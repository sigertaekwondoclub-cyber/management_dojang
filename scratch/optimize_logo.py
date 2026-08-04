import os
from PIL import Image

logo_path = "/media/lian/Ubuntu/Siger TC/siger-tkd-manager/public/logo-siger.png"
public_dir = "/media/lian/Ubuntu/Siger TC/siger-tkd-manager/public"
app_dir = "/media/lian/Ubuntu/Siger TC/siger-tkd-manager/src/app"

if not os.path.exists(logo_path):
    print("Error: logo-siger.png not found")
    exit(1)

print("Processing image for background removal and cropping...")
img = Image.open(logo_path).convert("RGBA")
w, h = img.size
pixels = img.load()

visited = set()
background = set()
TOLERANCE = 80

def get_dist(c1, c2):
    return ((c1[0]-c2[0])**2 + (c1[1]-c2[1])**2 + (c1[2]-c2[2])**2)**0.5

# BFS Floodfill from the 4 corners
queue = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]
for x, y in queue:
    visited.add((x, y))

while queue:
    cx, cy = queue.pop(0)
    ccol = pixels[cx, cy]
    background.add((cx, cy))
    
    for nx, ny in [(cx-1, cy), (cx+1, cy), (cx, cy-1), (cx, cy+1)]:
        if 0 <= nx < w and 0 <= ny < h and (nx, ny) not in visited:
            ncol = pixels[nx, ny]
            if get_dist(ccol, ncol) < TOLERANCE or (ncol[0] > 180 and ncol[1] > 180 and ncol[2] > 180):
                visited.add((nx, ny))
                queue.append((nx, ny))

# Make background pixels transparent
for x, y in background:
    pixels[x, y] = (0, 0, 0, 0)

# Find bounding box of remaining non-transparent pixels
min_x, min_y = w, h
max_x, max_y = 0, 0
for y in range(h):
    for x in range(w):
        if pixels[x, y][3] > 0:
            if x < min_x: min_x = x
            if y < min_y: min_y = y
            if x > max_x: max_x = x
            if y > max_y: max_y = y

if max_x < min_x or max_y < min_y:
    print("Error: Could not isolate logo.")
    exit(1)

cropped = img.crop((min_x, min_y, max_x + 1, max_y + 1))
print(f"Isolated logo size: {cropped.size}")

# Pad to square
max_dim = max(cropped.width, cropped.height)
square_img = Image.new("RGBA", (max_dim, max_dim), (0, 0, 0, 0))
paste_x = (max_dim - cropped.width) // 2
paste_y = (max_dim - cropped.height) // 2
square_img.paste(cropped, (paste_x, paste_y))
print("Padded logo to square canvas")

# Save outputs
def save_icon(img_to_save, size, filename, directory, format_type):
    resized = img_to_save.resize((size, size), Image.Resampling.LANCZOS)
    path = os.path.join(directory, filename)
    resized.save(path, format=format_type)
    print(f"Saved {path}")

# Public outputs
save_icon(square_img, 32, "favicon.ico", public_dir, "ICO")
save_icon(square_img, 192, "icon-192x192.png", public_dir, "PNG")
save_icon(square_img, 512, "icon-512x512.png", public_dir, "PNG")

# App outputs
save_icon(square_img, 32, "favicon.ico", app_dir, "ICO")
save_icon(square_img, 192, "icon.png", app_dir, "PNG")
save_icon(square_img, 192, "apple-icon.png", app_dir, "PNG")

print("All optimized assets updated successfully!")
