import iconDark from "../../assets/brand/syllapin-icon-dark.png"
import iconLight from "../../assets/brand/syllapin-icon-light.png"
import wordDark from "../../assets/brand/syllapin-wordmark-dark.png"
import wordLight from "../../assets/brand/syllapin-wordmark-light.png"

type BrandLockupProps = {
  size?: "header" | "large"
}

export function BrandLockup({ size = "header" }: BrandLockupProps) {
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
