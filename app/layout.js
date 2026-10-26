import "./globals.css";
export const metadata={title:"Nutrition Tracker",description:"Private, offline nutrition tracker",manifest:"/manifest.json",
  icons:{icon:"/icon-192.png",apple:"/apple-icon.png"},appleWebApp:{capable:true,title:"Nutrition",statusBarStyle:"black-translucent"}};
export const viewport={themeColor:"#0a0a0b",width:"device-width",initialScale:1,viewportFit:"cover"};
export default function Root({children}){return <html lang="en"><body>{children}</body></html>}
