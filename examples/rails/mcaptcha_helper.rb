# frozen_string_literal: true

# Attributes for a form protected by mCaptcha:
#
#   <%= form_with model: @message, data: mcaptcha_form_data do |form| %>
#     ...
#     <%= render "mcaptcha" %>
#   <% end %>
#
# The worker is copied into app/assets/builds by the JS build (see the README),
# so Propshaft serves it under a digested name: a new version is never cached.
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
      mcaptcha_worker_url_value: asset_path("mcaptcha-pow-worker.js"),
      mcaptcha_solving_value: t("mcaptcha.solving"),
      mcaptcha_solved_value: t("mcaptcha.solved"),
      mcaptcha_failed_value: t("mcaptcha.failed"),
      mcaptcha_required_value: t("mcaptcha.required")
    }
  end
end
