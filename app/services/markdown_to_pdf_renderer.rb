# frozen_string_literal: true

require "prawn"

class MarkdownToPdfRenderer
  APP_ROOT = Rails.root
  PAGE_MARGIN = [ 52, 58, 56, 58 ].freeze
  BODY_SIZE = 10.5
  BODY_LEADING = 3
  ROW_PADDING = 12
  LABEL_WIDTH = 86
  FONT_FAMILY_NAME = "MarkdownToPdf"
  COLORS = {
    ink: "2A2520",
    soft_ink: "514A42",
    muted: "81786E",
    faint: "B9AEA3",
    rule: "E8DED2",
    accent: "B66C4D",
    accent_soft: "F6E8E0",
    panel: "FCF8F2"
  }.freeze
  MEAL_COLORS = {
    breakfast: "C76F3D",
    lunch: "4B8A6A",
    dinner: "5F6FB2",
    snack: "B9852B",
    other: "8A6D9B",
    detail: "7A746D",
    note: "7A746D"
  }.freeze
  FONT_CANDIDATES = [
    {
      normal: APP_ROOT.join("app/assets/fonts/NotoSans-Regular.ttf").to_s,
      bold: APP_ROOT.join("app/assets/fonts/NotoSans-Bold.ttf").to_s
    },
    {
      normal: "/System/Library/Fonts/Supplemental/Arial.ttf",
      bold: "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
    },
    {
      normal: "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
      bold: "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
    },
    {
      normal: "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf",
      bold: "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf"
    }
  ].freeze

  Segment = Struct.new(:text, :bold, keyword_init: true)

  def render(markdown)
    Prawn::Document.new(page_size: "A4", margin: PAGE_MARGIN).tap do |pdf|
      configure_font(pdf)
      render_document(pdf, parse_markdown(markdown))
      render_footer(pdf)
    end.render
  end

  def render_file(markdown, output_path)
    File.binwrite(output_path, render(markdown))
  end

  private

  def render_document(pdf, document)
    render_title(pdf, document[:title])

    document[:blocks].each do |block|
      case block[:type]
      when :heading
        render_section_heading(pdf, block[:text])
      when :item
        render_item(pdf, block[:text])
      when :paragraph
        render_paragraph(pdf, block[:text])
      end
    end
  end

  def render_title(pdf, title)
    heading, subtitle = title_parts(title)

    pdf.fill_color COLORS[:accent]
    pdf.text "EXPORT REPAS", size: 8, style: :bold, character_spacing: 1.6
    pdf.move_down 8

    pdf.fill_color COLORS[:ink]
    pdf.text heading, size: 27, style: :bold, leading: 1
    pdf.move_down 7

    if subtitle.present?
      pdf.fill_color COLORS[:muted]
      pdf.text subtitle, size: 11, leading: 2
      pdf.move_down 18
    else
      pdf.move_down 14
    end

    pdf.stroke_color COLORS[:rule]
    pdf.line_width 1
    pdf.stroke_horizontal_rule
    pdf.move_down 22
  end

  def render_section_heading(pdf, text)
    ensure_space(pdf, 74)
    pdf.move_down 8 unless pdf.cursor > pdf.bounds.height - 120

    pdf.fill_color COLORS[:accent_soft]
    pdf.fill_rounded_rectangle [ 0, pdf.cursor ], pdf.bounds.width, 36, 6

    pdf.fill_color COLORS[:accent]
    pdf.text_box friendly_section_date(text),
      at: [ 14, pdf.cursor - 10 ],
      width: pdf.bounds.width - 28,
      height: 18,
      size: 12,
      style: :bold

    pdf.move_down 48
  end

  def render_item(pdf, text)
    label, description = meal_parts(text)
    description = description.presence || label
    label = label.present? && description != label ? label : "Note"
    meal_color = meal_color(label)

    description_height = pdf.height_of_formatted(
      formatted_segments(description, color: COLORS[:soft_ink]),
      width: description_width(pdf),
      size: BODY_SIZE,
      leading: BODY_LEADING
    )
    row_height = [ description_height + (ROW_PADDING * 2), 40 ].max

    ensure_space(pdf, row_height + 12)

    top = pdf.cursor
    pdf.fill_color COLORS[:panel]
    pdf.fill_rounded_rectangle [ 0, top ], pdf.bounds.width, row_height, 6

    pdf.fill_color meal_color
    pdf.fill_rectangle [ 0, top - 6 ], 3, row_height - 12

    pdf.fill_color meal_color
    pdf.text_box label,
      at: [ 16, top - ROW_PADDING - 2 ],
      width: LABEL_WIDTH - 10,
      height: row_height - (ROW_PADDING * 2),
      size: 9,
      style: :bold,
      overflow: :shrink_to_fit

    pdf.formatted_text_box formatted_segments(description, color: COLORS[:soft_ink]),
      at: [ LABEL_WIDTH + 22, top - ROW_PADDING ],
      width: description_width(pdf),
      height: row_height - (ROW_PADDING * 2),
      size: BODY_SIZE,
      leading: BODY_LEADING,
      overflow: :expand

    pdf.move_down row_height + 8
  end

  def render_paragraph(pdf, text)
    return if text.blank?

    ensure_space(pdf, 34)
    pdf.formatted_text formatted_segments(text, color: COLORS[:soft_ink]),
      size: BODY_SIZE,
      leading: BODY_LEADING
    pdf.move_down 8
  end

  def render_footer(pdf)
    pdf.number_pages "Carnet - page <page> / <total>",
      at: [ pdf.bounds.left, 24 ],
      width: pdf.bounds.width,
      align: :right,
      size: 8,
      color: COLORS[:faint]
  end

  def configure_font(pdf)
    font_family = configured_font_family || detected_font_family

    if font_family
      pdf.font_families.update(FONT_FAMILY_NAME => font_family)
      pdf.font FONT_FAMILY_NAME
    else
      warn "No Unicode font found; falling back to PDF built-in Helvetica."
      warn "Set MARKDOWN_TO_PDF_FONT=/path/to/font.ttf for broader UTF-8 support."
      Prawn::Fonts::AFM.hide_m17n_warning = true
      pdf.font "Helvetica"
    end
  end

  def configured_font_family
    return unless ENV["MARKDOWN_TO_PDF_FONT"]

    normal = ENV.fetch("MARKDOWN_TO_PDF_FONT")
    bold = ENV.fetch("MARKDOWN_TO_PDF_BOLD_FONT", normal)

    unless File.file?(normal)
      warn "MARKDOWN_TO_PDF_FONT does not point to a file: #{normal}"
      return
    end

    {
      normal: normal,
      bold: File.file?(bold) ? bold : normal
    }
  end

  def detected_font_family
    FONT_CANDIDATES.find do |candidate|
      File.file?(candidate[:normal]) && File.file?(candidate[:bold])
    end
  end

  def parse_markdown(markdown)
    title = nil
    blocks = []

    markdown.each_line do |raw_line|
      line = raw_line.chomp

      case line
      when /\A#\s+(.+)\z/
        title ||= Regexp.last_match(1)
      when /\A##\s+(.+)\z/
        blocks << { type: :heading, text: Regexp.last_match(1) }
      when /\A-\s+(.+)\z/
        blocks << { type: :item, text: Regexp.last_match(1) }
      when /\A\s*\z/
        next
      else
        blocks << { type: :paragraph, text: line }
      end
    end

    { title: title || "Export repas", blocks: blocks }
  end

  def title_parts(title)
    if title =~ /\ARepas du (?<from>\d{4}-\d{2}-\d{2}) au (?<to>\d{4}-\d{2}-\d{2})\z/
      [ "Repas", "#{short_date(Regexp.last_match[:from])} au #{short_date(Regexp.last_match[:to])}" ]
    else
      [ title, nil ]
    end
  end

  def friendly_section_date(text)
    date = Date.iso8601(text)
    I18n.l(date, format: :long).capitalize
  rescue ArgumentError
    text
  end

  def short_date(text)
    date = Date.iso8601(text)
    month = I18n.t("date.month_names")[date.month]
    "#{date.day} #{month} #{date.year}"
  rescue ArgumentError
    text
  end

  def meal_parts(text)
    if text =~ /\A\*\*(?<label>.+?)\*\*\s*:?\s*(?<description>.*)\z/
      match = Regexp.last_match
      label = match[:label].sub(/:\z/, "")
      description = match[:description]
      return [ label, description ]
    end

    [ nil, text ]
  end

  def meal_color(label)
    normalized = I18n.transliterate(label.to_s).downcase

    if normalized.include?("petit")
      MEAL_COLORS[:breakfast]
    elsif normalized.include?("dej")
      MEAL_COLORS[:lunch]
    elsif normalized.include?("diner")
      MEAL_COLORS[:dinner]
    elsif normalized.include?("snack")
      MEAL_COLORS[:snack]
    elsif normalized.include?("detail")
      MEAL_COLORS[:detail]
    elsif normalized.include?("autre")
      MEAL_COLORS[:other]
    else
      MEAL_COLORS[:note]
    end
  end

  def ensure_space(pdf, height)
    pdf.start_new_page if pdf.cursor < height
  end

  def description_width(pdf)
    pdf.bounds.width - LABEL_WIDTH - 22
  end

  def formatted_segments(text, color:)
    parse_inline(text).map do |segment|
      {
        text: segment.text,
        styles: segment.bold ? [ :bold ] : [],
        color: color
      }
    end
  end

  def parse_inline(text)
    segments = []
    remaining = text.dup
    bold = false

    until remaining.empty?
      marker_index = remaining.index("**")

      if marker_index
        value = remaining[0...marker_index]
        segments << Segment.new(text: value, bold: bold) unless value.empty?
        bold = !bold
        remaining = remaining[(marker_index + 2)..] || ""
      else
        segments << Segment.new(text: remaining, bold: bold)
        remaining = ""
      end
    end

    segments
  end
end
