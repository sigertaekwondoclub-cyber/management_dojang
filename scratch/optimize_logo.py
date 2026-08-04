import os
from PIL import Image

logo_path = "/media/lian/Ubuntu/Siger TC/siger-tkd-manager/public/logo-siger.png"
public_dir = "/media/lian/Ubuntu/Siger TC/siger-tkd-manager/public"

if not os.path.exists(logo_path):
    print("Error: logo-siger.png not found")
    exit(1)

with Image.open(logo_path) as img:
    # Convert to RGBA for transparency support
    img = img.convert("RGBA")
    
    # Save favicon.ico (32x32)
    favicon = img.resize((32, 32), Image.Resampling.LANCZOS)
    favicon.save(os.path.join(public_dir, "favicon.ico"), format="ICO")
    print("Generated favicon.ico")
    
    # Save icon-192x192.png
    icon192 = img.resize((192, 192), Image.Resampling.LANCZOS)
    icon192.save(os.path.join(public_dir, "icon-192x192.png"), format="PNG")
    print("Generated icon-192x192.png")
    
    # Save icon-512x512.png
    icon512 = img.resize((512, 512), Image.Resampling.LANCZOS)
    icon512.save(os.path.join(public_dir, "icon-512x512.png"), format="PNG")
    print("Generated icon-512x512.png")
