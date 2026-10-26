# frozen_string_literal: true

require "net/http"
require "json"

# Checks a token with the mCaptcha instance, from the server: the only check
# that counts, since anything running in the browser can be bypassed.
#
# Fail-closed: anything but an explicit `valid: true` rejects the token,
# timeouts and unreachable instance included. A missing setting raises at the
# first call instead of letting submissions through.
#
#   return head(:unprocessable_content) unless McaptchaVerification.valid?(params[:mcaptcha__token])
class McaptchaVerification
  OPEN_TIMEOUT = 3
  READ_TIMEOUT = 5

  NETWORK_ERRORS = [
    Net::OpenTimeout, Net::ReadTimeout, SocketError, SystemCallError, OpenSSL::SSL::SSLError
  ].freeze

  def self.valid?(token)
    new(token).valid?
  end

  def initialize(token,
                 instance_url: ENV.fetch("MCAPTCHA_URL"),
                 sitekey: ENV.fetch("MCAPTCHA_SITEKEY"),
                 secret: ENV.fetch("MCAPTCHA_ACCOUNT_SECRET"))
    @token = token
    @instance_url = instance_url
    @sitekey = sitekey
    @secret = secret
  end

  def valid?
    return false if @token.blank?

    response = post_siteverify
    return false unless response.is_a?(Net::HTTPSuccess)

    # The instance answers 200 for an invalid token too: only `valid` counts.
    body = JSON.parse(response.body)
    body.is_a?(Hash) && body["valid"] == true
  rescue *NETWORK_ERRORS, JSON::ParserError => error
    Rails.logger.warn("[mCaptcha] verification failed: #{error.class}: #{error.message}")
    false
  end

  private

  def post_siteverify
    uri = URI.join(@instance_url.end_with?("/") ? @instance_url : "#{@instance_url}/", "api/v1/pow/siteverify")
    payload = { token: @token, key: @sitekey, secret: @secret }.to_json

    Net::HTTP.start(uri.host, uri.port, use_ssl: uri.scheme == "https",
                                        open_timeout: OPEN_TIMEOUT, read_timeout: READ_TIMEOUT) do |http|
      http.post(uri.request_uri, payload, "Content-Type" => "application/json")
    end
  end
end
