# Lottie Animation Setup Guide

## 📦 Installation Required

To use the Lottie animation, you need to install the lottie-react package:

```bash
npm install lottie-react
```

## 🎯 What I've Created

### 1. **CoverPageAnimation Component** (`/public/assets/lottie-animations/coverPage.tsx`)

I've created a comprehensive Lottie component with multiple variants:

#### **Main Component: CoverPageAnimation**
- ✅ Fully customizable props (width, height, speed, autoplay, loop)
- ✅ TypeScript support with proper typing
- ✅ Ref management for animation control
- ✅ Event handlers (onComplete, onDataReady)

#### **Additional Components:**
- `TicketAnimationWithControls` - With play/pause/stop controls
- `SimpleTicketAnimation` - Basic usage with minimal props

### 2. **Integration in Login Page**

The animation is now integrated into your login page at:
- **Left side of the split layout**
- **Responsive design** (hidden on mobile, full display on desktop)
- **Glass-morphism container** with backdrop blur effects
- **Drop shadow** for better visual appeal

## 🎨 Usage Examples

### **Basic Usage:**
```tsx
import CoverPageAnimation from '../../public/assets/lottie-animations/coverPage'

<CoverPageAnimation 
  width="100%"
  height="300px"
  autoplay={true}
  loop={true}
  speed={1}
/>
```

### **With Controls:**
```tsx
import { TicketAnimationWithControls } from '../../public/assets/lottie-animations/coverPage'

<TicketAnimationWithControls 
  showControls={true}
  width={400}
  height={400}
/>
```

### **Simple Version:**
```tsx
import { SimpleTicketAnimation } from '../../public/assets/lottie-animations/coverPage'

<SimpleTicketAnimation size={300} />
```

## 🔧 Props Available

### **CoverPageAnimation Props:**
```typescript
interface CoverPageAnimationProps {
  className?: string        // Additional CSS classes
  width?: number | string   // Animation width
  height?: number | string  // Animation height
  autoplay?: boolean        // Auto start animation
  loop?: boolean           // Loop animation
  speed?: number           // Playback speed (1 = normal)
}
```

## 🚀 Next Steps

1. **Install the package:**
   ```bash
   npm install lottie-react
   ```

2. **Restart your dev server:**
   ```bash
   npm run dev
   ```

3. **Visit the login page:**
   ```
   http://localhost:3000/user-login
   ```

4. **Customize the animation** by modifying props in the login page component

## 🎯 Current Integration

The animation is now integrated in your login page (`/app/user-login/page.tsx`):

```tsx
<CoverPageAnimation 
  width="100%"
  height="100%"
  autoplay={true}
  loop={true}
  speed={1}
  className="drop-shadow-lg"
/>
```

## 🔧 Customization Options

You can easily customize the animation by:

1. **Changing animation speed:** Modify the `speed` prop (0.5 = half speed, 2 = double speed)
2. **Adding custom styling:** Use the `className` prop for additional CSS
3. **Controlling playback:** Set `autoplay={false}` and use the controls version
4. **Responsive sizing:** Adjust width/height props or use CSS classes

The animation will automatically load your `tickets.json` file and display beautifully in the login page! 🎉