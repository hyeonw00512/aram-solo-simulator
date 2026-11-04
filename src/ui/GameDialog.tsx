import {useEffect,useRef,type ReactNode} from 'react';

/** One native modal surface: viewport placement, focus trap and Escape handling. */
export function GameDialog({open,label,onMinimize,className='',children,focusSelector}:{open:boolean;label:string;onMinimize:()=>void;className?:string;children:ReactNode;focusSelector?:string}){
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{
  if(!open)return;
  const dialog=ref.current!,previous=document.activeElement as HTMLElement|null,overflow=document.body.style.overflow;
  dialog.showModal();document.body.style.overflow='hidden';
  const focus=focusSelector?dialog.querySelector<HTMLElement>(focusSelector):dialog.querySelector<HTMLElement>('h2');
  focus?.focus({preventScroll:true});
  return()=>{dialog.close();document.body.style.overflow=overflow;
   const parent=previous?.closest('dialog');if(previous?.isConnected&&(!parent||parent.open))previous.focus({preventScroll:true});
  };
 },[open,focusSelector]);
 return <dialog ref={ref} className={`game-dialog ${className}`} aria-label={label} data-active={open} onCancel={e=>{e.preventDefault();onMinimize()}}>{children}</dialog>;
}
export function DialogHeading({eyebrow,title,onMinimize,children}:{eyebrow:string;title:string;onMinimize:()=>void;children?:ReactNode}){
 return <header className="game-dialog-heading"><div><span className="eyebrow">{eyebrow}</span><h2 tabIndex={-1}>{title}</h2>{children}</div><button onClick={onMinimize}>전장 보기 <kbd>Esc</kbd></button></header>;
}
