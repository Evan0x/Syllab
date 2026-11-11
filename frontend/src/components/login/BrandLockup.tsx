import iconDark from "../../assets/brand/syllapin-icon-dark.png"
import iconLight from "../../assets/brand/syllapin-icon-light.png"
import wordDark from "../../assets/brand/syllapin-wordmark-dark.png"
import wordLight from "../../assets/brand/syllapin-wordmark-light.png"
import symbolDark from "../../assets/login/syllapin-symbol-dark.svg"
import symbol from "../../assets/login/syllapin-symbol.svg"

type BrandLockupProps = {
  size?: "header" | "large" | "mark"
}

export function BrandLockup({ size = "header" }: BrandLockupProps) {
  if (size === "mark") {
    return (
      <span className="brand-mark">
        <img className="brand-mark-light" src={symbol} alt="" width="27.8621" height="32" />
        <img className="brand-mark-dark" src={symbolDark} alt="" width="27.8621" height="32" />
        <span className="brand-mark-name">Syllapin</span>
      </span>
    )
  }

  return (
    <div className={`brand-lockup ${size === "large" ? "brand-lockup-large" : ""}`}>
      <span className="logo-light flex items-center">
        <img src={iconLight} alt="" />
        <img src={wordLight} alt="Syllapin" />
      </span>
      <span className="logo-dark items-center">
        <img src={iconDark} alt="" />
        <img src={wordDark} alt="Syllapin" />
      </span>
    </div>
  )
}
