// src/components/FloorPlanCanvas.jsx
import React, { useRef, useEffect, useState } from 'react';
import { RotateCw, Trash2, PlusCircle, RefreshCw, Download, Layers, Unlink } from 'lucide-react';

export default function FloorPlanCanvas({ selectedZones, suggestedLayout, use3DPrinter }) {
  const canvasRef = useRef(null);
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const dragRef = useRef(null);

  // Constants for Modular Desk geometry
  const SHORT_BASE = 32;
  const LONG_BASE = 64;
  const HEIGHT = 28; // ~32 * sin(60)

  // Initialize layout based on selectedZones or AI suggestedLayout
  const resetLayout = () => {
    const defaultItems = [];
    let idCounter = 1;
    const nextId = (prefix) => `${prefix}_${idCounter++}_${Date.now()}`;
    const timestamp = Date.now();

    // 1. Always place Teacher Desk
    defaultItems.push({
      id: nextId('teacher'),
      type: 'teacherDesk',
      x: 80,
      y: 75,
      rotation: 0,
      label: 'Öğretmen Kürsüsü'
    });

    // 2. Place 3D Printer only if use3DPrinter is true
    if (use3DPrinter) {
      defaultItems.push({
        id: nextId('printer'),
        type: 'printerTable',
        x: 720,
        y: 100,
        rotation: 0
      });
    }

    // 3. Check if suggestedLayout is available
    if (suggestedLayout && (suggestedLayout.groups || suggestedLayout.items)) {
      const groups = suggestedLayout.groups || [];
      const individualItems = suggestedLayout.items || [];

      // Define grid spots for groups to prevent overlaps
      const groupSpots = [
        { cx: 350, cy: 260 },
        { cx: 600, cy: 260 },
        { cx: 250, cy: 460 },
        { cx: 550, cy: 460 },
        { cx: 450, cy: 110 }
      ];

      let spotIndex = 0;

      // Spawn Groups
      groups.forEach((groupType) => {
        if (spotIndex >= groupSpots.length) return;
        const { cx, cy } = groupSpots[spotIndex];
        const groupId = `group_${groupType}_${timestamp}_${spotIndex}`;

        if (groupType === 'hex') {
          const R = 54; 
          for (let i = 0; i < 6; i++) {
            const angle = i * 60;
            const rad = (angle * Math.PI) / 180;
            defaultItems.push({
              id: nextId('desk_hex'),
              type: 'desk',
              x: cx + R * Math.cos(rad),
              y: cy + R * Math.sin(rad),
              rotation: (angle - 90 + 360) % 360,
              groupId
            });
          }
          spotIndex++;
        } else if (groupType === 'octagon') {
          const R = 72; 
          for (let i = 0; i < 8; i++) {
            const angle = i * 45;
            const rad = (angle * Math.PI) / 180;
            defaultItems.push({
              id: nextId('desk_oct'),
              type: 'desk',
              x: cx + R * Math.cos(rad),
              y: cy + R * Math.sin(rad),
              rotation: (angle - 90 + 360) % 360,
              groupId
            });
          }
          spotIndex++;
        } else if (groupType === 'tri') {
          const R = 32;
          for (let i = 0; i < 3; i++) {
            const angle = i * 120 - 30;
            const rad = (angle * Math.PI) / 180;
            defaultItems.push({
              id: nextId('desk_tri'),
              type: 'desk',
              x: cx + R * Math.cos(rad),
              y: cy + R * Math.sin(rad),
              rotation: (angle - 90 + 360) % 360,
              groupId
            });
          }
          spotIndex++;
        } else if (groupType === 'double') {
          defaultItems.push({ id: nextId('desk_double'), type: 'desk', x: cx, y: cy - 14, rotation: 180, groupId });
          defaultItems.push({ id: nextId('desk_double'), type: 'desk', x: cx, y: cy + 14, rotation: 0, groupId });
          spotIndex++;
        } else if (groupType === 'quad') {
          defaultItems.push({ id: nextId('desk_quad'), type: 'desk', x: cx - 27, y: cy - 14, rotation: 180, groupId });
          defaultItems.push({ id: nextId('desk_quad'), type: 'desk', x: cx - 27, y: cy + 14, rotation: 0, groupId });
          defaultItems.push({ id: nextId('desk_quad'), type: 'desk', x: cx + 27, y: cy - 14, rotation: 180, groupId });
          defaultItems.push({ id: nextId('desk_quad'), type: 'desk', x: cx + 27, y: cy + 14, rotation: 0, groupId });
          spotIndex++;
        } else if (groupType === 'zigzag') {
          defaultItems.push({ id: nextId('desk_zig'), type: 'desk', x: cx - 81, y: cy + 14, rotation: 0, groupId });
          defaultItems.push({ id: nextId('desk_zig'), type: 'desk', x: cx - 27, y: cy - 14, rotation: 180, groupId });
          defaultItems.push({ id: nextId('desk_zig'), type: 'desk', x: cx + 27, y: cy + 14, rotation: 0, groupId });
          defaultItems.push({ id: nextId('desk_zig'), type: 'desk', x: cx + 81, y: cy - 14, rotation: 180, groupId });
          spotIndex++;
        }
      });

      // Spawn Individual Items
      let pcIndex = 0;
      let poufIndex = 0;

      individualItems.forEach((itemType) => {
        if (itemType === 'pcDesk') {
          const x = 280 + pcIndex * 80;
          if (x < 680) {
            defaultItems.push({ id: nextId('pc'), type: 'pcDesk', x, y: 70, rotation: 0 });
            pcIndex++;
          }
        } else if (itemType === 'pouf') {
          const x = 400 + (poufIndex % 4) * 60;
          const y = 350 + Math.floor(poufIndex / 4) * 60;
          const poufColors = ['#65a30d', '#334155', '#0284c7', '#ea580c'];
          const color = poufColors[poufIndex % poufColors.length];
          defaultItems.push({ id: nextId('pouf'), type: 'pouf', x, y, rotation: 0, color });
          poufIndex++;
        }
      });
    } else {
      // Fallback to static selectedZones initialization
      const activeZones = selectedZones.length > 0 ? selectedZones : ['Araştırma', 'İş Birliği'];

      activeZones.forEach((zone) => {
        if (zone === 'İş Birliği') {
          const cx = 350;
          const cy = 280;
          const R = 54;
          const groupId = `group_hex_${timestamp}_default`;
          for (let i = 0; i < 6; i++) {
            const angle = i * 60;
            const rad = (angle * Math.PI) / 180;
            defaultItems.push({
              id: nextId('desk_hex'),
              type: 'desk',
              x: cx + R * Math.cos(rad),
              y: cy + R * Math.sin(rad),
              rotation: (angle - 90 + 360) % 360,
              groupId
            });
          }

          const tx = 200;
          const ty = 460;
          const rT = 32;
          const groupTriId = `group_tri_${timestamp}_default`;
          for (let i = 0; i < 3; i++) {
            const angle = i * 120 - 30;
            const rad = (angle * Math.PI) / 180;
            defaultItems.push({
              id: nextId('desk_tri'),
              type: 'desk',
              x: tx + rT * Math.cos(rad),
              y: ty + rT * Math.sin(rad),
              rotation: (angle - 90 + 360) % 360,
              groupId: groupTriId
            });
          }
        }

        if (zone === 'Araştırma') {
          defaultItems.push({ id: nextId('pc'), type: 'pcDesk', x: 280, y: 70, rotation: 0 });
          defaultItems.push({ id: nextId('pc'), type: 'pcDesk', x: 360, y: 70, rotation: 0 });
          defaultItems.push({ id: nextId('pc'), type: 'pcDesk', x: 440, y: 70, rotation: 0 });
        }

        if (zone === 'Geliştirme') {
          const cx = 580;
          const cy = 250;
          const doubleGroupId = `group_double_${timestamp}_default`;
          defaultItems.push({ id: nextId('desk_double'), type: 'desk', x: cx, y: cy - 14, rotation: 180, groupId: doubleGroupId });
          defaultItems.push({ id: nextId('desk_double'), type: 'desk', x: cx, y: cy + 14, rotation: 0, groupId: doubleGroupId });

          defaultItems.push({ id: nextId('pouf'), type: 'pouf', x: 530, y: 220, rotation: 0, color: '#65a30d' });
          defaultItems.push({ id: nextId('pouf'), type: 'pouf', x: 630, y: 220, rotation: 0, color: '#334155' });
          defaultItems.push({ id: nextId('pouf'), type: 'pouf', x: 530, y: 280, rotation: 0, color: '#0284c7' });
          defaultItems.push({ id: nextId('pouf'), type: 'pouf', x: 630, y: 280, rotation: 0, color: '#ea580c' });
        }

        if (zone === 'Sunum' || zone === 'Etkileşim') {
          const cx = 700;
          const cy = 440;
          const sunumGroupId = `group_quad_${timestamp}_default`;
          defaultItems.push({ id: nextId('desk_sunum'), type: 'desk', x: cx - 32, y: cy - 15, rotation: 270, groupId: sunumGroupId });
          defaultItems.push({ id: nextId('desk_sunum'), type: 'desk', x: cx + 32, y: cy - 15, rotation: 90, groupId: sunumGroupId });
          defaultItems.push({ id: nextId('desk_sunum'), type: 'desk', x: cx - 32, y: cy + 15, rotation: 270, groupId: sunumGroupId });
          defaultItems.push({ id: nextId('desk_sunum'), type: 'desk', x: cx + 32, y: cy + 15, rotation: 90, groupId: sunumGroupId });
        }
      });

      if (defaultItems.filter(item => item.type === 'desk').length === 0) {
        const fallbackGroupId = `group_double_${timestamp}_fallback`;
        defaultItems.push({ id: nextId('desk'), type: 'desk', x: 450, y: 300, rotation: 0, groupId: fallbackGroupId });
        defaultItems.push({ id: nextId('desk'), type: 'desk', x: 450, y: 272, rotation: 180, groupId: fallbackGroupId });
      }
    }

    setItems(defaultItems);
    setSelectedId(null);
  };

  // Reset layout whenever selectedZones, suggestedLayout, or use3DPrinter changes
  useEffect(() => {
    resetLayout();
  }, [selectedZones, suggestedLayout, use3DPrinter]);

  // Drawing Function
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    // Helpers
    const drawRect = (ctx, x, y, width, height, bgColor, label, borderColor) => {
      ctx.fillStyle = bgColor;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(x, y, width, height, 6);
      } else {
        ctx.rect(x, y, width, height);
      }
      ctx.fill();
      ctx.strokeStyle = borderColor || '#475569';
      ctx.lineWidth = 2;
      ctx.stroke();
      if (label) {
        ctx.fillStyle = '#334155';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(label, x + width / 2, y + height / 2 + 3);
      }
    };

    const drawChair = (ctx, cx, cy, color = '#f97316', border = '#ea580c') => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(cx, cy, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = border;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(cx, cy, 10, Math.PI * 0.8, Math.PI * 2.2);
      ctx.stroke();
    };

    // Draw Room Elements
    // Teacher board
    drawRect(ctx, w / 2 - 120, 5, 240, 10, '#1e293b', '', '#000000');
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ETKİLEŞİMLİ TAHTA', w / 2, 13);

    // Draw Zone Overlays (subtle background circles)
    const regions = [
      { x: 200, y: 160, name: 'Araştırma', color: '#ef4444' },
      { x: 500, y: 160, name: 'Etkileşim', color: '#3b82f6' },
      { x: 750, y: 180, name: 'Sunum', color: '#a855f7' },
      { x: 200, y: 440, name: 'İş Birliği', color: '#f97316' },
      { x: 500, y: 440, name: 'Geliştirme', color: '#eab308' },
      { x: 750, y: 440, name: 'Üretim', color: '#22c55e' }
    ];

    regions.forEach((r) => {
      if (selectedZones.includes(r.name)) {
        ctx.fillStyle = r.color;
        ctx.globalAlpha = 0.06;
        ctx.beginPath();
        ctx.arc(r.x, r.y, 110, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;

        ctx.fillStyle = r.color;
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(r.name.toUpperCase(), r.x, r.y - 120);
      }
    });

    // Draw all items
    items.forEach((item) => {
      ctx.save();
      ctx.translate(item.x, item.y);
      ctx.rotate((item.rotation * Math.PI) / 180);

      const isSelected = item.id === selectedId;

      if (item.type === 'desk') {
        const yOffset = -HEIGHT / 2; // -14

        // 1. Draw outer frame (Darker plastic/metal bumper edge, like original photo)
        ctx.fillStyle = '#475569'; // Slate dark grey border
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1.0;
        ctx.beginPath();
        // Geometry mirroring the 8gen outline:
        // Top-left chamfer starting, top flat edge, top-right chamfer, 
        // straight vertical sides, bottom chamfer tapering inwards, bottom flat edge.
        ctx.moveTo(-16, -14); // Top edge left
        ctx.lineTo(16, -14);  // Top edge right
        ctx.lineTo(32, -4);   // Mid-right (widest chamfer point)
        ctx.lineTo(32, 6);    // Vertical side straight down
        ctx.lineTo(16, 14);   // Bottom edge right
        ctx.lineTo(-16, 14);  // Bottom edge left
        ctx.lineTo(-32, 6);   // Vertical side straight down
        ctx.lineTo(-32, -4);  // Mid-left (widest chamfer point)
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // 2. Draw inner laminate desk top surface (white/light grey as in the original photo)
        ctx.fillStyle = '#f8fafc'; // White/light-grey laminate top
        ctx.beginPath();
        ctx.moveTo(-14, -11);
        ctx.lineTo(14, -11);
        ctx.lineTo(29, -3);
        ctx.lineTo(29, 4);
        ctx.lineTo(14, 11);
        ctx.lineTo(-14, 11);
        ctx.lineTo(-29, 4);
        ctx.lineTo(-29, -3);
        ctx.closePath();
        ctx.fill();

        // 3. Draw a realistic pencil/pen tray slot (The dark grey horizontal bar on the front edge as seen in the photo)
        ctx.fillStyle = '#334155'; // Dark grey plastic tray
        ctx.beginPath();
        if (ctx.roundRect) {
          // Centered near the student's edge (bottom flat edge)
          ctx.roundRect(-14, 7, 28, 2.5, 1);
        } else {
          ctx.rect(-14, 7, 28, 2.5);
        }
        ctx.fill();

        // 4. Draw modern student chair (Dark grey, matching the black/grey chairs in the photo)
        const chairX = 0;
        const chairY = 26; // Chair placed at the bottom edge (y = 14 + 12 = 26)
        
        // Draw 5-star base of chair
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 1.5;
        for (let a = 0; a < 5; a++) {
          const angle = (a * 2 * Math.PI) / 5 + Math.PI / 2;
          ctx.beginPath();
          ctx.moveTo(chairX, chairY);
          ctx.lineTo(chairX + Math.cos(angle) * 7, chairY + Math.sin(angle) * 7);
          ctx.stroke();
        }

        // Draw chair seat (Dark charcoal grey to match original photo)
        drawChair(ctx, chairX, chairY, '#334155', '#1e293b');
      } 
      else if (item.type === 'pcDesk') {
        // PC Desk
        drawRect(ctx, -30, -20, 60, 40, '#edd4b2', '', '#854d0e'); // Wooden frame
        drawRect(ctx, -27, -17, 54, 34, '#f8fafc'); // White top inlay
        
        // Screen
        drawRect(ctx, -20, -12, 40, 6, '#0f172a');
        
        // Keyboard
        ctx.fillStyle = '#475569';
        ctx.fillRect(-15, -2, 30, 7);
        
        // Chair base spokes
        const chairX = 0;
        const chairY = 32;
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 1.5;
        for (let a = 0; a < 5; a++) {
          const angle = (a * 2 * Math.PI) / 5 + Math.PI / 2;
          ctx.beginPath();
          ctx.moveTo(chairX, chairY);
          ctx.lineTo(chairX + Math.cos(angle) * 7, chairY + Math.sin(angle) * 7);
          ctx.stroke();
        }
        
        // Chair
        drawChair(ctx, chairX, chairY, '#facc15', '#ca8a04');
      } 
      else if (item.type === 'pouf') {
        // Square Pouf
        const color = item.color || '#65a30d';
        ctx.fillStyle = color;
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(-14, -14, 28, 28, 6);
        } else {
          ctx.rect(-14, -14, 28, 28);
        }
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.15)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-14, 0);
        ctx.lineTo(14, 0);
        ctx.stroke();
      } 
      else if (item.type === 'teacherDesk') {
        // Teacher Desk
        drawRect(ctx, -40, -20, 80, 40, '#854d0e', '', '#451a03'); // Mahogany finish
        drawRect(ctx, -36, -16, 72, 32, '#edd4b2'); // Wooden veneer inlay
        
        // Laptop
        drawRect(ctx, -15, -8, 30, 16, '#334155', '', '#1e293b'); // Dark keyboard base
        drawRect(ctx, -15, -12, 30, 4, '#94a3b8'); // Screen hinge area
        
        // Notebook / Document
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(18, -6, 12, 16);
        ctx.strokeStyle = '#cbd5e1';
        ctx.strokeRect(18, -6, 12, 16);
        
        // Cup of coffee
        ctx.fillStyle = '#78350f'; // Coffee brown
        ctx.beginPath();
        ctx.arc(-24, 0, 4, 0, Math.PI*2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff'; // White cup edge
        ctx.lineWidth = 1;
        ctx.stroke();

        // Chair base spokes
        const chairX = 0;
        const chairY = 32;
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 1.5;
        for (let a = 0; a < 5; a++) {
          const angle = (a * 2 * Math.PI) / 5 + Math.PI / 2;
          ctx.beginPath();
          ctx.moveTo(chairX, chairY);
          ctx.lineTo(chairX + Math.cos(angle) * 7, chairY + Math.sin(angle) * 7);
          ctx.stroke();
        }

        // Chair
        drawChair(ctx, chairX, chairY, '#475569', '#334155');
      } 
      else if (item.type === 'printerTable') {
        // 3D Printer Table
        drawRect(ctx, -50, -30, 100, 60, '#edd4b2', '', '#854d0e'); // Wooden printer table frame
        drawRect(ctx, -46, -26, 92, 52, '#f8fafc'); // White surface inlay
        
        // Filament Spool
        ctx.fillStyle = '#ef4444'; // Red filament spool
        ctx.beginPath();
        ctx.arc(-30, -5, 12, 0, Math.PI*2);
        ctx.fill();
        ctx.fillStyle = '#f8fafc';
        ctx.beginPath();
        ctx.arc(-30, -5, 5, 0, Math.PI*2);
        ctx.fill();
        
        // Printer Unit
        drawRect(ctx, -10, -20, 45, 40, '#1e293b', '3B YAZICI', '#0f172a');
        
        // Chair base spokes
        const chairX = 0;
        const chairY = 45;
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 1.5;
        for (let a = 0; a < 5; a++) {
          const angle = (a * 2 * Math.PI) / 5 + Math.PI / 2;
          ctx.beginPath();
          ctx.moveTo(chairX, chairY);
          ctx.lineTo(chairX + Math.cos(angle) * 7, chairY + Math.sin(angle) * 7);
          ctx.stroke();
        }
        
        // Yellow Chair
        drawChair(ctx, chairX, chairY, '#facc15', '#ca8a04');
      }

      // Draw Selected Highlight
      if (isSelected && isEditing) {
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(0, 0, 45, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        
        // Rotation handle dot
        ctx.fillStyle = '#3b82f6';
        ctx.beginPath();
        ctx.arc(0, -45, 5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    });

  }, [items, selectedId, isEditing]);

  // Drag & Click Handlers
  const getCanvasCoords = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    
    // Support mouse and touch events
    let clientX, clientY;
    if (e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const x = ((clientX - rect.left) / rect.width) * canvas.width;
    const y = ((clientY - rect.top) / rect.height) * canvas.height;
    return { x, y };
  };

  const handleStart = (e) => {
    if (!isEditing) return;
    const { x, y } = getCanvasCoords(e);

    // 1. Check if clicked on the rotation handle (blue dot) of the currently selected item
    if (selectedId) {
      const selectedItem = items.find(item => item.id === selectedId);
      if (selectedItem) {
        const rotRad = (selectedItem.rotation * Math.PI) / 180;
        const handleX = selectedItem.x + Math.sin(rotRad) * 45;
        const handleY = selectedItem.y - Math.cos(rotRad) * 45;
        const distToHandle = Math.hypot(x - handleX, y - handleY);
        
        if (distToHandle < 12) { // 12px grab area
          dragRef.current = {
            id: selectedId,
            isRotating: true
          };
          if (e.cancelable) e.preventDefault();
          return;
        }
      }
    }

    // 2. Find clicked item for movement
    let foundItem = null;
    // Search in reverse order to click top items first
    for (let i = items.length - 1; i >= 0; i--) {
      const item = items[i];
      const dist = Math.hypot(x - item.x, y - item.y);
      const clickRadius = item.type === 'printerTable' ? 45 : 30;
      if (dist < clickRadius) {
        foundItem = item;
        break;
      }
    }

    if (foundItem) {
      setSelectedId(foundItem.id);
      
      if (foundItem.groupId) {
        // Group drag: calculate initial offsets for all items in the group
        const groupItems = items.filter(item => item.groupId === foundItem.groupId);
        const offsets = groupItems.map(item => ({
          id: item.id,
          offsetX: x - item.x,
          offsetY: y - item.y
        }));
        dragRef.current = {
          id: foundItem.id,
          isRotating: false,
          isGroup: true,
          offsets
        };
      } else {
        dragRef.current = {
          id: foundItem.id,
          isRotating: false,
          isGroup: false,
          offsetX: x - foundItem.x,
          offsetY: y - foundItem.y
        };
      }
      if (e.cancelable) e.preventDefault();
    } else {
      setSelectedId(null);
    }
  };

  const handleMove = (e) => {
    if (!isEditing || !dragRef.current) return;
    const { x, y } = getCanvasCoords(e);
    
    if (dragRef.current.isRotating) {
      // Dynamic rotation drag logic
      const { id } = dragRef.current;
      setItems(prevItems => 
        prevItems.map(item => {
          if (item.id === id) {
            const dx = x - item.x;
            const dy = y - item.y;
            let angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
            let newRotation = (angleDeg + 90 + 360) % 360;
            
            // Snap to clean angles (15 degrees for student desks, 45 degrees for others)
            const step = item.type === 'desk' ? 15 : 45;
            newRotation = Math.round(newRotation / step) * step;
            
            return { ...item, rotation: newRotation % 360 };
          }
          return item;
        })
      );
    } else if (dragRef.current.isGroup) {
      // Drag group movement logic
      const { offsets } = dragRef.current;
      setItems(prevItems => 
        prevItems.map(item => {
          const match = offsets.find(o => o.id === item.id);
          if (match) {
            // Clamp inside canvas boundaries
            const nx = Math.max(30, Math.min(canvasRef.current.width - 30, x - match.offsetX));
            const ny = Math.max(30, Math.min(canvasRef.current.height - 30, y - match.offsetY));
            return { ...item, x: nx, y: ny };
          }
          return item;
        })
      );
    } else {
      // Drag single position movement logic
      const { id, offsetX, offsetY } = dragRef.current;
      setItems(prevItems => 
        prevItems.map(item => {
          if (item.id === id) {
            // Clamp inside canvas boundaries
            const nx = Math.max(30, Math.min(canvasRef.current.width - 30, x - offsetX));
            const ny = Math.max(30, Math.min(canvasRef.current.height - 30, y - offsetY));
            return { ...item, x: nx, y: ny };
          }
          return item;
        })
      );
    }
  };

  const handleEnd = () => {
    dragRef.current = null;
  };

  // Add layout manipulation tools
  const handleRotate = () => {
    if (!selectedId) return;
    setItems(prev =>
      prev.map(item => {
        if (item.id === selectedId) {
          // Desks rotate by 15 degrees for fine-grained alignments, others by 45 degrees
          const step = item.type === 'desk' ? 15 : 45;
          return { ...item, rotation: (item.rotation + step) % 360 };
        }
        return item;
      })
    );
  };

  const handleDelete = () => {
    if (!selectedId) return;
    // Don't delete teacher desk or printer table easily unless intended
    const item = items.find(i => i.id === selectedId);
    if (item && (item.type === 'teacherDesk' || item.type === 'printerTable')) {
      const confirmDelete = confirm(`${item.label || 'Sabit İstasyon'} silinsin mi?`);
      if (!confirmDelete) return;
    }
    setItems(prev => prev.filter(i => i.id !== selectedId));
    setSelectedId(null);
  };

  const handleUngroup = () => {
    if (!selectedId) return;
    const item = items.find(i => i.id === selectedId);
    if (!item || !item.groupId) return;
    
    // Remove groupId from all items that belong to the same group
    setItems(prev =>
      prev.map(i => {
        if (i.groupId === item.groupId) {
          const { groupId, ...rest } = i;
          return rest;
        }
        return i;
      })
    );
  };

  const handleAddItem = (type) => {
    const canvas = canvasRef.current;
    const cx = canvas ? canvas.width / 2 : 450;
    const cy = canvas ? canvas.height / 2 : 300;
    const id = `${type}_${Date.now()}`;
    
    let newItem = { id, type, x: cx, y: cy, rotation: 0 };
    if (type === 'teacherDesk') {
      newItem.label = 'Öğretmen Masası';
    } else if (type === 'printerTable') {
      newItem.label = '3B Yazıcı Masası';
    }

    setItems(prev => [...prev, newItem]);
    setSelectedId(id);
  };

  // Add group configurations directly
  const handleAddGroup = (groupType) => {
    const canvas = canvasRef.current;
    const cx = canvas ? canvas.width / 2 : 450;
    const cy = canvas ? canvas.height / 2 : 300;
    const newGroupItems = [];
    const timestamp = Date.now();
    const groupId = `group_${groupType}_${timestamp}`;

    if (groupType === 'hex') {
      // 6 modular desks in a hexagon (W_MAX = 64, H = 28)
      // Radius R is optimized to make adjacent desks touch side-by-side perfectly
      const R = 54; 
      for (let i = 0; i < 6; i++) {
        const angle = i * 60;
        const rad = (angle * Math.PI) / 180;
        newGroupItems.push({
          id: `desk_hex_${timestamp}_${i}`,
          type: 'desk',
          x: cx + R * Math.cos(rad),
          y: cy + R * Math.sin(rad),
          rotation: (angle - 90 + 360) % 360, // Oriented so chairs are on the outside, facing inwards
          groupId
        });
      }
    } else if (groupType === 'octagon') {
      // 8 modular desks in an octagon (W_MAX = 64, H = 28)
      // Radius R is optimized to align the semi-octagonal desks into a beautiful hollow octagon
      const R = 72; 
      for (let i = 0; i < 8; i++) {
        const angle = i * 45;
        const rad = (angle * Math.PI) / 180;
        newGroupItems.push({
          id: `desk_oct_${timestamp}_${i}`,
          type: 'desk',
          x: cx + R * Math.cos(rad),
          y: cy + R * Math.sin(rad),
          rotation: (angle - 90 + 360) % 360, // Oriented so chairs are on the outside, facing inwards
          groupId
        });
      }
    } else if (groupType === 'tri') {
      // 3 modular desks in a triangle
      // Radius R is optimized to let the three desks touch side-by-side perfectly
      const R = 32;
      for (let i = 0; i < 3; i++) {
        const angle = i * 120 - 30;
        const rad = (angle * Math.PI) / 180;
        newGroupItems.push({
          id: `desk_tri_${timestamp}_${i}`,
          type: 'desk',
          x: cx + R * Math.cos(rad),
          y: cy + R * Math.sin(rad),
          rotation: (angle - 90 + 360) % 360, // Oriented so chairs are on the outside, facing inwards
          groupId
        });
      }
    } else if (groupType === 'double') {
      // 2 modular desks facing each other (rectangle block)
      newGroupItems.push({ id: `desk_double_${timestamp}_0`, type: 'desk', x: cx, y: cy - 14, rotation: 180, groupId });
      newGroupItems.push({ id: `desk_double_${timestamp}_1`, type: 'desk', x: cx, y: cy + 14, rotation: 0, groupId });
    } else if (groupType === 'quad') {
      // 4-person block (two double desks side-by-side, spaced by 54px horizontally to avoid overlap)
      newGroupItems.push({ id: `desk_quad_${timestamp}_0`, type: 'desk', x: cx - 27, y: cy - 14, rotation: 180, groupId });
      newGroupItems.push({ id: `desk_quad_${timestamp}_1`, type: 'desk', x: cx - 27, y: cy + 14, rotation: 0, groupId });
      newGroupItems.push({ id: `desk_quad_${timestamp}_2`, type: 'desk', x: cx + 27, y: cy - 14, rotation: 180, groupId });
      newGroupItems.push({ id: `desk_quad_${timestamp}_3`, type: 'desk', x: cx + 27, y: cy + 14, rotation: 0, groupId });
    } else if (groupType === 'zigzag') {
      // 4-person zigzag row (alternating side-by-side, spaced by 54px horizontally to avoid overlap)
      newGroupItems.push({ id: `desk_zig_${timestamp}_0`, type: 'desk', x: cx - 81, y: cy + 14, rotation: 0, groupId });
      newGroupItems.push({ id: `desk_zig_${timestamp}_1`, type: 'desk', x: cx - 27, y: cy - 14, rotation: 180, groupId });
      newGroupItems.push({ id: `desk_zig_${timestamp}_2`, type: 'desk', x: cx + 27, y: cy + 14, rotation: 0, groupId });
      newGroupItems.push({ id: `desk_zig_${timestamp}_3`, type: 'desk', x: cx + 81, y: cy - 14, rotation: 180, groupId });
    }

    setItems(prev => [...prev, ...newGroupItems]);
    if (newGroupItems.length > 0) {
      setSelectedId(newGroupItems[0].id);
    }
  };

  // Download layout as PNG
  const handleDownloadPNG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Temp canvas to draw layout title
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height + 60;
    const tempCtx = tempCanvas.getContext('2d');

    // Fill background
    tempCtx.fillStyle = '#ffffff';
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

    // Draw Title Header
    tempCtx.fillStyle = '#1e293b';
    tempCtx.font = 'bold 20px sans-serif';
    tempCtx.fillText('YENİLİKÇİ SINIF - 2D YERLEŞİM PLANI', 40, 40);

    // Copy original canvas contents
    tempCtx.drawImage(canvas, 0, 60);

    const url = tempCanvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Yenilikci_Sinif_Yerlesim_Plani.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div id="layoutSection" className="glass-panel rounded-3xl p-6 md:p-10 border-t-8 border-indigo-500 bg-white shadow-lg space-y-6 mt-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center border-b border-slate-200 pb-4 gap-4">
        <div>
          <h3 className="text-xl font-bold text-slate-800">📐 Sınıf Yerleşim Planı (2D)</h3>
          <p className="text-xs text-slate-500 mt-1">
            Masalar birleşebilir modüler yapıdadır. 2'li birleştirildiğinde dikdörtgen, 3'lüde üçgen ve 6'lıda hexagon küme oluşturur.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setIsEditing(!isEditing)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 ${
              isEditing 
                ? 'bg-blue-600 text-white hover:bg-blue-700 ring-2 ring-blue-100' 
                : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>{isEditing ? 'Düzenleme Modundan Çık' : 'Tasarımı Düzenle (Editör)'}</span>
          </button>
          
          <button
            onClick={handleDownloadPNG}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl border border-slate-200 shadow-sm transition-all"
            title="Şemayı Resim Olarak İndir"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Editor Controls Bar */}
      {isEditing && (
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-4 animate-fade-in">
          {/* Main Manipulation Tools */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Seçili Eleman:</span>
              {selectedId ? (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleRotate}
                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-lg text-xs font-bold transition-all"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    <span>Döndür</span>
                  </button>
                  {(() => {
                    const selItem = items.find(i => i.id === selectedId);
                    if (selItem && selItem.groupId) {
                      return (
                        <button
                          onClick={handleUngroup}
                          className="flex items-center gap-1 px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg text-xs font-bold transition-all"
                          title="Bu grubu dağıtarak masaları bağımsız hale getirir"
                        >
                          <Unlink className="w-3.5 h-3.5" />
                          <span>Grubu Dağıt</span>
                        </button>
                      );
                    }
                    return null;
                  })()}
                  <button
                    onClick={handleDelete}
                    className="flex items-center gap-1 px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-800 rounded-lg text-xs font-bold transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Sil</span>
                  </button>
                </div>
              ) : (
                <span className="text-xs text-slate-400 italic">Ekranda bir elemana tıklayıp seçin.</span>
              )}
            </div>
            
            <button
              onClick={resetLayout}
              className="flex items-center gap-1 px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-bold transition-all border border-slate-300 shadow-inner"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Tasarımı Sıfırla</span>
            </button>
          </div>

          {/* Add Elements Panel */}
          <div className="space-y-2">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Eleman Ekle:</div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleAddItem('desk')}
                className="flex items-center gap-1 px-3 py-2 bg-white border border-slate-300 hover:border-blue-400 rounded-xl text-xs font-semibold text-slate-700 shadow-sm transition-all"
              >
                <PlusCircle className="w-3.5 h-3.5 text-blue-500" />
                <span>Tekli Modüler Masa</span>
              </button>
              <button
                onClick={() => handleAddItem('pouf')}
                className="flex items-center gap-1 px-3 py-2 bg-white border border-slate-300 hover:border-blue-400 rounded-xl text-xs font-semibold text-slate-700 shadow-sm transition-all"
              >
                <PlusCircle className="w-3.5 h-3.5 text-green-500" />
                <span>Puf Koltuk</span>
              </button>
              <button
                onClick={() => handleAddItem('pcDesk')}
                className="flex items-center gap-1 px-3 py-2 bg-white border border-slate-300 hover:border-blue-400 rounded-xl text-xs font-semibold text-slate-700 shadow-sm transition-all"
              >
                <PlusCircle className="w-3.5 h-3.5 text-yellow-500" />
                <span>Bilgisayar İstasyonu</span>
              </button>
              <button
                onClick={() => handleAddItem('teacherDesk')}
                className="flex items-center gap-1 px-3 py-2 bg-white border border-slate-300 hover:border-blue-400 rounded-xl text-xs font-semibold text-slate-700 shadow-sm transition-all"
              >
                <PlusCircle className="w-3.5 h-3.5 text-slate-500" />
                <span>Öğretmen Masası</span>
              </button>
              <button
                onClick={() => handleAddItem('printerTable')}
                className="flex items-center gap-1 px-3 py-2 bg-white border border-slate-300 hover:border-blue-400 rounded-xl text-xs font-semibold text-slate-700 shadow-sm transition-all"
              >
                <PlusCircle className="w-3.5 h-3.5 text-red-500 animate-pulse" />
                <span>3B Yazıcı Masası</span>
              </button>
            </div>
          </div>

          {/* Preset Group Structures */}
          <div className="space-y-2">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Hazır Küme Ekle (Birleştirilmiş Masalar):</div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleAddGroup('double')}
                className="flex items-center gap-1 px-3 py-2 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 rounded-xl text-xs font-semibold text-indigo-800 shadow-sm transition-all"
              >
                <span>👥 İkili Masa Kümesi</span>
              </button>
              <button
                onClick={() => handleAddGroup('tri')}
                className="flex items-center gap-1 px-3 py-2 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 rounded-xl text-xs font-semibold text-indigo-800 shadow-sm transition-all"
              >
                <span>🔺 Üçlü Masa Kümesi</span>
              </button>
              <button
                onClick={() => handleAddGroup('quad')}
                className="flex items-center gap-1 px-3 py-2 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 rounded-xl text-xs font-semibold text-indigo-800 shadow-sm transition-all"
              >
                <span>🟦 Dörtlü Masa Kümesi (Blok)</span>
              </button>
              <button
                onClick={() => handleAddGroup('zigzag')}
                className="flex items-center gap-1 px-3 py-2 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 rounded-xl text-xs font-semibold text-indigo-800 shadow-sm transition-all"
              >
                <span>〰️ Dörtlü Dalga Kümesi (Zigzag)</span>
              </button>
              <button
                onClick={() => handleAddGroup('hex')}
                className="flex items-center gap-1 px-3 py-2 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 rounded-xl text-xs font-semibold text-indigo-800 shadow-sm transition-all"
              >
                <span>🛑 Altılı Takım Kümesi (Hexagon)</span>
              </button>
              <button
                onClick={() => handleAddGroup('octagon')}
                className="flex items-center gap-1 px-3 py-2 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 rounded-xl text-xs font-semibold text-indigo-800 shadow-sm transition-all"
              >
                <span>🌀 Sekizli Takım Kümesi (Ahtapot)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Canvas */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-slate-50 p-4 relative select-none">
        <canvas
          ref={canvasRef}
          id="floorPlan"
          width="900"
          height="600"
          onMouseDown={handleStart}
          onMouseMove={handleMove}
          onMouseUp={handleEnd}
          onTouchStart={handleStart}
          onTouchMove={handleMove}
          onTouchEnd={handleEnd}
          className={`mx-auto block max-w-full rounded-xl shadow-md border bg-white ${
            isEditing ? 'cursor-grab border-blue-400 shadow-lg' : 'border-slate-300'
          }`}
        />
        {isEditing && (
          <div className="absolute top-6 right-6 bg-blue-600/90 text-white text-[10px] md:text-xs font-bold px-3 py-1 rounded-full shadow-md backdrop-blur-sm pointer-events-none">
            Editör Modu: Elemanları sürükleyip bırakabilirsiniz
          </div>
        )}
      </div>
    </div>
  );
}
