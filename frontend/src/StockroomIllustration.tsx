/** A small shop shelf, drawn in SVG so the artwork stays crisp at every size. */
export default function StockroomIllustration() {
  return (
    <svg
      className="stockroom-illustration"
      viewBox="0 0 460 330"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <pattern
          id="paper-hatch"
          width="5"
          height="5"
          patternUnits="userSpaceOnUse"
        >
          <path d="M0 5 5 0" stroke="#BC906C" strokeOpacity=".16" />
        </pattern>
      </defs>
      <path d="M34 299H436" stroke="#D7C9B3" />
      <path d="M68 59V294M404 59V294" stroke="#C5AA83" strokeWidth="8" />
      <path d="M66 63H406" stroke="#C5AA83" strokeWidth="8" />
      <path d="M79 78H393V178H79Z" fill="#E9DFCC" fillOpacity=".5" />
      <path d="M79 194H393V280H79Z" fill="#E9DFCC" fillOpacity=".5" />
      <path d="M76 182H397M76 284H397" stroke="#8B6748" strokeWidth="9" />
      <path d="M76 178H397M76 280H397" stroke="#B6956F" strokeWidth="6" />
      {/* Folded coffee bags. */}
      <path d="m96 108 5-15h51l5 15v66H96Z" fill="#B87448" stroke="#895A3F" />
      <path d="M101 94H152M98 107H155" stroke="#895A3F" />
      <path d="M108 120H145V157H108Z" fill="#F7EDD7" />
      <path
        d="M122 129c-9 1-10 13-4 16s13-6 11-11c-1-3-4-5-7-5Z"
        fill="#6A4B38"
      />
      <path d="m125 131-6 12" stroke="#E8D0AB" strokeWidth="1.2" />
      <text
        x="126"
        y="153"
        textAnchor="middle"
        fill="#6A4B38"
        fontSize="5"
        letterSpacing="1"
      >
        COFFEE
      </text>
      <path d="m161 116 5-16h42l5 16v58h-52Z" fill="#C58C5C" stroke="#956B45" />
      <path d="M166 101H208M163 116H211" stroke="#956B45" />
      <path d="M173 128H201V159H173Z" fill="#F4E7CB" />
      <text
        x="187"
        y="141"
        textAnchor="middle"
        fill="#78563C"
        fontSize="6"
        letterSpacing="1"
      >
        COFFEE
      </text>
      <path d="M180 148H194M183 152H191" stroke="#B48658" />
      {/* Milk cartons. */}
      <path d="m241 105 17-18 17 18v69h-34Z" fill="#F7F1E1" stroke="#989F86" />
      <path d="m275 105 10-7v76h-10Z" fill="#D6DDC5" stroke="#989F86" />
      <path d="m258 87 10-7 17 18-10 7M258 87V105" stroke="#989F86" />
      <path d="M241 137H275V162H241Z" fill="#829276" />
      <text
        x="258"
        y="152"
        textAnchor="middle"
        fill="#F7F1E1"
        fontSize="6"
        letterSpacing=".8"
      >
        MILK
      </text>
      <path d="m290 112 15-16 15 16v62h-30Z" fill="#F5EFDf" stroke="#989F86" />
      <path d="m320 112 9-6v68h-9Z" fill="#D6DDC5" stroke="#989F86" />
      <path d="m305 96 9-6 15 16-9 6M305 96V112" stroke="#989F86" />
      <path d="M290 140H320V162H290Z" fill="#829276" />
      <text
        x="305"
        y="154"
        textAnchor="middle"
        fill="#F7F1E1"
        fontSize="5"
        letterSpacing=".8"
      >
        MILK
      </text>
      {/* Pantry tins. */}
      <rect
        x="344"
        y="131"
        width="31"
        height="43"
        rx="3"
        fill="#C1AC67"
        stroke="#94834E"
      />
      <path d="M345 134H374M345 171H374" stroke="#F1E4BB" />
      <rect x="349" y="144" width="21" height="17" fill="#F6EDD2" />
      <text
        x="360"
        y="155"
        textAnchor="middle"
        fill="#827343"
        fontSize="5"
        letterSpacing="1"
      >
        TEA
      </text>
      {/* Cardboard stock crates. */}
      <rect
        x="96"
        y="218"
        width="134"
        height="60"
        rx="2"
        fill="#D2B087"
        stroke="#A5835D"
      />
      <path
        d="M96 232H230M96 266H230M141 218V278M186 218V278"
        stroke="#B08B64"
      />
      <rect x="147" y="237" width="34" height="20" rx="2" fill="#E9D7B7" />
      <path d="M157 244H172M157 249H168" stroke="#B08B64" />
      <path
        d="M106 224H126M198 224H218"
        stroke="#97734D"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <rect
        x="250"
        y="204"
        width="118"
        height="74"
        rx="2"
        fill="#DBBF98"
        stroke="#AD8B63"
      />
      <rect x="250" y="204" width="118" height="74" fill="url(#paper-hatch)" />
      <path d="M303 205V277" stroke="#EAD7B6" strokeWidth="13" />
      <path d="M257 211H361" stroke="#AD8B63" />
      <rect
        x="318"
        y="239"
        width="38"
        height="27"
        rx="1"
        fill="#F7EDD7"
        transform="rotate(-4 318 239)"
      />
      <text
        x="337"
        y="249"
        textAnchor="middle"
        fill="#936747"
        fontSize="5"
        letterSpacing=".8"
      >
        PANTRY
      </text>
      <path d="M325 254H348M325 258H339" stroke="#C1A17A" />
      {/* Shelf tickets are decorative, not live stock counts. */}
      <rect
        x="100"
        y="180"
        width="62"
        height="15"
        rx="1"
        fill="#F8F2E6"
        stroke="#C3AF90"
      />
      <text
        x="131"
        y="190"
        textAnchor="middle"
        fill="#8B795F"
        fontSize="5.5"
        letterSpacing="1.2"
      >
        DAILY GOODS
      </text>
      <rect
        x="281"
        y="282"
        width="62"
        height="15"
        rx="1"
        fill="#F8F2E6"
        stroke="#C3AF90"
      />
      <text
        x="312"
        y="292"
        textAnchor="middle"
        fill="#8B795F"
        fontSize="5.5"
        letterSpacing="1.2"
      >
        THE PANTRY
      </text>
      {/* Shopkeeper's stamp. */}
      <g transform="translate(364 48) rotate(12)">
        <circle r="37" fill="#F5EBD8" stroke="#A64F35" />
        <circle r="31" stroke="#A64F35" strokeDasharray="2 3" />
        <text
          y="-9"
          textAnchor="middle"
          fill="#A64F35"
          fontSize="6"
          letterSpacing="1.5"
        >
          SMALL SHOP.
        </text>
        <text
          y="5"
          textAnchor="middle"
          fill="#A64F35"
          fontSize="11"
          fontFamily="Georgia, serif"
          fontStyle="italic"
        >
          Big picture.
        </text>
        <path d="M-11 14H11" stroke="#A64F35" />
        <circle cy="21" r="1.5" fill="#A64F35" />
      </g>
      <path d="M39 100V239M35 100H43M35 239H43" stroke="#C9B89D" />
      <text
        transform="translate(29 200) rotate(-90)"
        fill="#A39379"
        fontSize="6"
        letterSpacing="2"
      >
        A PLACE FOR EVERYTHING
      </text>
    </svg>
  )
}
