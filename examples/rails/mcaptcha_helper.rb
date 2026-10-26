# frozen_string_literal: true

# Attributes for a form protected by mCaptcha:
#
#   <%= form_with model: @message, data: mcaptcha_form_data do |form| %>
#     ...
#     <%= render "mcaptcha" %>
#   <% end %>
#
# The sitekey and instance URL are public by design; the account secret never
# leaves the server (see McaptchaVerification).
module McaptchaHelper
  def mcaptcha_form_data
    {
      controller: "mcaptcha",
      action: "submit->mcaptcha#guard",
      mcaptcha_instance_url_value: ENV.fetch("MCAPTCHA_URL"),
      mcaptcha_sitekey_value: ENV.fetch("MCAPTCHA_SITEKEY"),
      mcaptcha_worker_url_value: "/mcaptcha-pow-worker.js",
      mcaptcha_solving_value: t("mcaptcha.solving"),
      mcaptcha_solved_value: t("mcaptcha.solved"),
      mcaptcha_failed_value: t("mcaptcha.failed"),
      mcaptcha_required_value: t("mcaptcha.required")
    }
  end
end
